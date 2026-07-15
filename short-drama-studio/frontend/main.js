import { state, loadState, saveState, createProject, currentProject, setStep, removeProject, clearProjects, createId } from './state.js';
import * as api from './api.js';
import { extractTitle, extractCharacter, parseScenes, buildVideoPrompt, delay } from './utils.js';
import * as ui from './ui.js';

/** Ensures a project exists and renders the app.
 * @returns {Promise<void>}
 */
async function init() {
  loadState();
  if (!state.currentProjectId || !state.projects[state.currentProjectId]) createProject();
  bindEvents();
  ui.renderAll();
  await checkHealth(true);
  setInterval(() => checkHealth(false), 30000);
}

/** Checks backend readiness and optionally opens setup.
 * @param {boolean} promptForKey whether to open setup when missing
 * @returns {Promise<void>}
 */
async function checkHealth(promptForKey) {
  try {
    const health = await api.getHealth();
    ui.renderServerStatus(health.apiKeyConfigured ? 'ready' : 'missing');
    if (!health.apiKeyConfigured && promptForKey) ui.openKeyDialog(true);
  } catch {
    ui.renderServerStatus('offline');
  }
}

/** Runs an action with centralized UI error reporting.
 * @param {() => Promise<void>} action async action
 * @returns {Promise<void>}
 */
async function run(action) {
  try {
    await action();
  } catch (error) {
    if (error.code === 'API_KEY_REQUIRED' || error.code === 'INVALID_API_KEY') ui.openKeyDialog(true);
    ui.toast(error.message || '操作失败，请稍后重试', 'error');
  }
}

/** Persists idea form values.
 * @returns {void}
 */
function saveIdeaForm() {
  const project = currentProject();
  const idea = document.querySelector('#ideaInput')?.value.trim();
  if (!idea) throw new Error('请先输入短剧想法');
  project.steps.idea = idea;
  project.steps.episodeCount = Math.max(1, Number(document.querySelector('#episodeCount')?.value) || 1);
  project.steps.episodeDuration = Math.max(1, Number(document.querySelector('#episodeDuration')?.value) || 1);
  project.updatedAt = Date.now();
  saveState();
}

/** Generates the episodic plot.
 * @returns {Promise<void>}
 */
async function generatePlot() {
  saveIdeaForm();
  const project = currentProject();
  ui.progress('正在生成剧情', 0, 1);
  const systemPrompt = `你是专业短剧策划。请输出剧名、完整角色设定和 ${project.steps.episodeCount} 集剧情。每集约 ${project.steps.episodeDuration} 分钟，包含冲突、转折和结尾钩子。角色设定必须具体到年龄、脸型、发型、服装和配饰。`;
  setStep('plot', await api.generateText(systemPrompt, project.steps.idea));
  project.title = extractTitle(project.steps.plot);
  project.character = extractCharacter('', project.steps.plot);
  state.currentStep = 'plot';
  ui.renderAll();
}

/** Generates a shot-by-shot script.
 * @returns {Promise<void>}
 */
async function generateScript() {
  const project = currentProject();
  if (!project.steps.plot) throw new Error('请先生成剧情');
  const systemPrompt = '你是短剧导演和分镜师。根据剧情输出可拍摄分镜脚本。每个镜头单独一行，严格使用“场景1：描述”格式；描述应包含人物、动作、表情、环境、光线和景别，并保持角色外貌与服装一致。';
  setStep('script', await api.generateText(systemPrompt, project.steps.plot, 0.75));
  project.character = extractCharacter(project.steps.script, project.steps.plot);
  state.currentStep = 'script';
  ui.renderAll();
}

/** Generates keyframe images sequentially with per-item errors.
 * @returns {Promise<void>}
 */
async function generateKeyframes() {
  const project = currentProject();
  const scenes = parseScenes(project.steps.script || '');
  if (!scenes.length) throw new Error('脚本中没有可识别的场景，请使用“场景1：...”格式');
  const ratio = project.orientation === 'portrait' ? '9:16' : '16:9';
  const images = [];
  for (let index = 0; index < scenes.length; index += 1) {
    ui.progress('正在生成关键帧', index, scenes.length);
    const scene = scenes[index];
    const prompt = `短剧《${project.title || extractTitle(project.steps.plot)}》关键帧。完整角色设定：${project.character.name}，${project.character.description}。当前场景：${scene.description}。严格保持同一人物脸型、发型、年龄、服装和配饰，电影级光影，清晰主体，${ratio === '9:16' ? '竖屏' : '横屏'}构图。`;
    try {
      const result = await api.generateImage(prompt, ratio);
      images.push({ ...result, label: scene.label, description: scene.description });
    } catch (error) {
      images.push({ localUrl: '', remoteUrl: '', label: scene.label, description: scene.description, error: error.message });
    }
  }
  setStep('keyframes', images);
  state.currentStep = 'keyframes';
  ui.renderAll();
}

/** Builds episode/fragment state from successful keyframes.
 * @returns {void}
 */
function prepareVideos() {
  const project = currentProject();
  const images = (project.steps.keyframes || []).filter((image) => image.remoteUrl);
  if (!images.length) throw new Error('没有可用于视频生成的关键帧');
  const episodeCount = Math.min(project.steps.episodeCount || 1, images.length);
  const perEpisode = Math.ceil(images.length / episodeCount);
  project.episodes = Array.from({ length: episodeCount }, (_, episodeIndex) => ({
    index: episodeIndex + 1,
    title: `第 ${episodeIndex + 1} 集`,
    fragments: images.slice(episodeIndex * perEpisode, (episodeIndex + 1) * perEpisode).map((image, fragmentIndex) => ({
      id: createId(), label: image.label || `片段 ${fragmentIndex + 1}`, description: image.description,
      imageUrl: image.remoteUrl, localImagePath: image.localUrl, videoId: '', videoUrl: '', videoStatus: 'idle', videoError: '',
    })),
  })).filter((episode) => episode.fragments.length);
  project.steps.video = { preparedAt: Date.now() };
  project.updatedAt = Date.now();
  state.currentStep = 'video';
  state.videoPanelOpen = true;
  saveState();
  ui.renderAll();
}

/** Polls a video task until terminal state.
 * @param {string} videoId task ID
 * @param {AbortSignal} signal cancellation signal
 * @returns {Promise<string>} local video URL
 */
async function pollVideo(videoId, signal) {
  for (;;) {
    if (signal.aborted) throw new DOMException('已取消', 'AbortError');
    const result = await api.queryVideo(videoId, signal);
    if (result.status === 'completed') {
      if (!result.videoUrl) throw new Error('视频已完成，但没有返回可播放地址');
      return result.videoUrl;
    }
    if (['failed', 'error', 'cancelled'].includes(result.status)) throw new Error('Agnes 视频任务失败');
    await delay(8000);
  }
}

/** Generates one video fragment with full continuity context.
 * @param {number} episodeIndex episode index
 * @param {number} fragmentIndex fragment index
 * @param {AbortSignal} signal cancellation signal
 * @returns {Promise<void>}
 */
async function generateFragment(episodeIndex, fragmentIndex, signal) {
  const project = currentProject();
  const fragment = project.episodes[episodeIndex].fragments[fragmentIndex];
  fragment.videoStatus = 'generating';
  fragment.videoError = '';
  saveState();
  ui.renderVideoPanel();
  try {
    const portrait = project.orientation === 'portrait';
    fragment.videoId = await api.createVideo({
      prompt: buildVideoPrompt(project, episodeIndex, fragmentIndex),
      imageUrl: fragment.imageUrl,
      localImagePath: fragment.localImagePath,
      width: portrait ? 736 : 1312,
      height: portrait ? 1312 : 736,
      seed: 42,
    });
    fragment.videoUrl = await pollVideo(fragment.videoId, signal);
    fragment.videoStatus = 'done';
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    fragment.videoStatus = 'error';
    fragment.videoError = error.message;
  } finally {
    saveState();
    ui.renderVideoPanel();
  }
}

/** Generates all unfinished fragments sequentially.
 * @returns {Promise<void>}
 */
async function generateAllVideos() {
  const project = currentProject();
  const pending = [];
  project.episodes.forEach((episode, episodeIndex) => episode.fragments.forEach((fragment, fragmentIndex) => {
    if (fragment.videoStatus !== 'done') pending.push([episodeIndex, fragmentIndex]);
  }));
  if (!pending.length) return ui.toast('全部片段已经生成', 'success');
  state.activeAbort?.abort();
  state.activeAbort = new AbortController();
  for (let index = 0; index < pending.length; index += 1) {
    ui.progress('正在生成视频', index, pending.length);
    await generateFragment(...pending[index], state.activeAbort.signal);
  }
  state.activeAbort = null;
  ui.renderAll();
}

/** Merges all completed local fragments.
 * @returns {Promise<void>}
 */
async function mergeAllVideos() {
  const paths = currentProject().episodes.flatMap((episode) => episode.fragments).map((fragment) => fragment.videoUrl).filter((url) => url?.startsWith('/outputs/'));
  if (paths.length < 2) throw new Error('至少需要两个已完成的本地视频片段');
  ui.progress('正在使用 ffmpeg 合并', 0, 1);
  ui.playVideo(await api.mergeVideos(paths));
  ui.toast('视频合并完成', 'success');
}

/** Navigates to an available workflow step.
 * @param {string} step target step
 * @returns {Promise<void>}
 */
async function navigate(step) {
  const project = currentProject();
  if (step === 'script' && !project.steps.script) return generateScript();
  if (step === 'video' && !project.episodes.length) return prepareVideos();
  const targetIndex = ui.STEPS.findIndex(([key]) => key === step);
  const activeIndex = ui.STEPS.findIndex(([key]) => key === state.currentStep);
  if (project.steps[step] == null && targetIndex > activeIndex + 1) throw new Error('请按顺序完成前面的步骤');
  state.currentStep = step;
  state.videoPanelOpen = step === 'video';
  ui.renderAll();
}

/** Handles delegated click actions.
 * @param {MouseEvent} event click event
 * @returns {Promise<void>}
 */
async function handleAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  event.stopPropagation();
  const action = target.dataset.action;
  await run(async () => {
    if (action === 'select-project') { state.currentProjectId = target.dataset.id; state.currentStep = 'idea'; saveState(); ui.renderAll(); }
    else if (action === 'delete-project') { if (confirm('确定删除这个项目吗？')) { removeProject(target.dataset.id); ui.renderAll(); } }
    else if (action === 'navigate') await navigate(target.dataset.step);
    else if (action === 'save-idea') { saveIdeaForm(); ui.toast('想法已保存', 'success'); }
    else if (action === 'generate-plot' || action === 'regenerate-plot') await generatePlot();
    else if (action === 'regenerate-script') await generateScript();
    else if (action === 'save-text') { setStep(target.dataset.key, document.querySelector(`#${target.dataset.key}Text`).value); ui.toast('修改已保存', 'success'); }
    else if (action === 'copy') { await navigator.clipboard.writeText(currentProject().steps[target.dataset.key]); ui.toast('已复制', 'success'); }
    else if (action === 'generate-keyframes') await generateKeyframes();
    else if (action === 'prepare-videos') prepareVideos();
    else if (action === 'generate-videos') await generateAllVideos();
    else if (action === 'regenerate-video') await generateFragment(Number(target.dataset.episode), Number(target.dataset.fragment), new AbortController().signal);
    else if (action === 'merge-videos') await mergeAllVideos();
    else if (action === 'toggle-video-panel') { state.videoPanelOpen = !state.videoPanelOpen; ui.renderVideoPanel(); }
    else if (action === 'play-video') ui.playVideo(target.dataset.url);
    else if (action === 'close-video') { document.querySelector('#videoModal').style.display = 'none'; }
    else if (action === 'open-key') ui.openKeyDialog(false);
  });
}

/** Binds global and static controls.
 * @returns {void}
 */
function bindEvents() {
  document.addEventListener('click', handleAction);
  document.querySelector('#btnNewProject').addEventListener('click', () => { createProject(); ui.renderAll(); });
  document.querySelector('#btnClearData').addEventListener('click', () => { if (confirm('确定清除全部本地项目吗？')) { clearProjects(); ui.renderAll(); } });
  document.querySelector('#projectNameInput').addEventListener('change', (event) => { const project = currentProject(); project.name = event.target.value.trim() || '未命名项目'; project.updatedAt = Date.now(); saveState(); ui.renderProjects(); });
  document.querySelectorAll('[data-orient]').forEach((button) => button.addEventListener('click', () => { currentProject().orientation = button.dataset.orient; saveState(); ui.renderAll(); }));
  document.querySelector('#keyForm').addEventListener('submit', (event) => run(async () => {
    event.preventDefault();
    const key = document.querySelector('#apiKeyInput').value;
    const persist = document.querySelector('#persistKey').checked;
    await api.configureKey(key, persist);
    document.querySelector('#apiKeyInput').value = '';
    ui.closeKeyDialog();
    ui.renderServerStatus('ready');
    ui.toast(persist ? 'API Key 已保存到 backend/.env' : 'API Key 已保存到服务内存', 'success');
  }));
  document.querySelector('#closeKeyDialog').addEventListener('click', () => ui.closeKeyDialog());
}

document.addEventListener('DOMContentLoaded', init);

