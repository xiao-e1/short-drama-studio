import { state, currentProject } from './state.js';
import { escapeHtml } from './utils.js';

export const STEPS = [
  ['idea', '想法'], ['plot', '剧情'], ['script', '脚本'], ['keyframes', '关键帧'], ['video', '视频'],
];

/** Displays a transient message.
 * @param {string} message message
 * @param {'info'|'error'|'success'} [type] message type
 * @returns {void}
 */
export function toast(message, type = 'info') {
  const element = document.createElement('div');
  element.className = `toast-msg toast-${type}`;
  element.textContent = message;
  document.querySelector('#toastContainer').appendChild(element);
  setTimeout(() => element.remove(), 3500);
}

/** Updates backend readiness in the header.
 * @param {'ready'|'missing'|'offline'} status connection state
 * @returns {void}
 */
export function renderServerStatus(status) {
  const element = document.querySelector('#serverStatus');
  const labels = { ready: '服务就绪', missing: '请设置 API Key', offline: '后端未连接' };
  element.textContent = labels[status];
  element.className = `server-status ${status === 'ready' ? 'connected' : 'disconnected'}`;
}

/** Opens the API key setup dialog.
 * @param {boolean} [required] whether dismissal should be discouraged
 * @returns {void}
 */
export function openKeyDialog(required = false) {
  const dialog = document.querySelector('#keyDialog');
  dialog.dataset.required = String(required);
  dialog.showModal();
  setTimeout(() => document.querySelector('#apiKeyInput').focus(), 0);
}

/** Closes the API key setup dialog.
 * @returns {void}
 */
export function closeKeyDialog() {
  document.querySelector('#keyDialog').close();
}

/** Renders the project list.
 * @returns {void}
 */
export function renderProjects() {
  const projects = Object.values(state.projects).sort((a, b) => b.updatedAt - a.updatedAt);
  document.querySelector('#projectListItems').innerHTML = projects.map((project) => `
    <div class="project-item ${project.id === state.currentProjectId ? 'active' : ''}" data-action="select-project" data-id="${escapeHtml(project.id)}">
      <div class="project-item-name">${escapeHtml(project.name)}</div>
      <div class="project-item-meta">${project.episodes?.length || 0} 集 · ${new Date(project.updatedAt).toLocaleDateString()}</div>
      <div class="project-item-actions"><button class="btn btn-xs btn-danger" data-action="delete-project" data-id="${escapeHtml(project.id)}" aria-label="删除项目">删除</button></div>
    </div>`).join('');
}

/** Renders workflow navigation.
 * @returns {void}
 */
export function renderSteps() {
  const project = currentProject();
  const activeIndex = STEPS.findIndex(([key]) => key === state.currentStep);
  document.querySelector('#stepBar').innerHTML = STEPS.map(([key, label], index) => {
    const done = project?.steps?.[key] != null;
    const status = index === activeIndex ? 'active' : done ? 'done' : 'pending';
    return `<button class="step-item" data-action="navigate" data-step="${key}"><span class="step-circle ${status}">${done && status !== 'active' ? '✓' : index + 1}</span><span class="step-label ${status}">${label}</span></button>${index < STEPS.length - 1 ? `<span class="step-connector ${done ? 'done' : ''}"></span>` : ''}`;
  }).join('');
}

/** Renders the idea form.
 * @param {any} project project
 * @returns {string} HTML
 */
function ideaView(project) {
  const count = project.steps.episodeCount || 3;
  const duration = project.steps.episodeDuration || 2;
  return `<section class="card"><div class="card-header"><h2 class="card-title">说出你的短剧想法</h2></div>
    <textarea class="textarea" id="ideaInput" placeholder="例如：实习生意外发现公司所有人都在重复同一天……">${escapeHtml(project.steps.idea || '')}</textarea>
    <div class="input-row"><label class="input-group">集数<input id="episodeCount" type="number" min="1" max="50" value="${count}"></label><label class="input-group">每集分钟<input id="episodeDuration" type="number" min="1" max="30" value="${duration}"></label><span class="info-badge">预计 ${count * duration} 分钟</span></div>
    <div class="card-actions"><button class="btn btn-primary" data-action="generate-plot">生成剧情</button><button class="btn btn-secondary" data-action="save-idea">保存</button></div></section>`;
}

/** Renders an editable generated-text step.
 * @param {string} key step key
 * @param {string} title title
 * @param {string} next next step
 * @param {any} project project
 * @returns {string} HTML
 */
function textView(key, title, next, project) {
  const value = project.steps[key] || '';
  return `<section class="card"><div class="card-header"><h2 class="card-title">${title}</h2><div class="card-actions"><button class="btn btn-secondary btn-sm" data-action="copy" data-key="${key}">复制</button><button class="btn btn-secondary btn-sm" data-action="regenerate-${key}">重新生成</button></div></div>
    <textarea class="textarea generated-text" id="${key}Text">${escapeHtml(value)}</textarea>
    <div class="card-actions"><button class="btn btn-secondary" data-action="save-text" data-key="${key}">保存修改</button><button class="btn btn-primary" data-action="navigate" data-step="${next}">${next === 'script' ? '生成脚本' : '进入关键帧'}</button></div></section>`;
}

/** Renders keyframes with lazy progressive loading.
 * @param {any} project project
 * @returns {string} HTML
 */
function keyframesView(project) {
  const images = Array.isArray(project.steps.keyframes) ? project.steps.keyframes : [];
  return `<section class="card"><div class="card-header"><h2 class="card-title">关键帧</h2><button class="btn btn-primary" data-action="generate-keyframes">${images.length ? '重新生成' : '生成全部关键帧'}</button></div><div id="taskProgress"></div>
    <div class="image-grid">${images.map((image, index) => `<figure class="image-card progressive ${image.error ? 'image-error' : ''}">${image.localUrl ? `<img src="${escapeHtml(image.localUrl)}" alt="${escapeHtml(image.label)}" loading="lazy" decoding="async">` : `<div class="img-placeholder">${escapeHtml(image.error || '等待生成')}</div>`}<figcaption class="img-label">${index + 1}. ${escapeHtml(image.label)}</figcaption></figure>`).join('') || '<div class="empty-state">脚本准备好后生成关键帧</div>'}</div>
    ${images.length ? '<div class="card-actions"><button class="btn btn-primary" data-action="prepare-videos">进入视频生成</button></div>' : ''}</section>`;
}

/** Renders video controls.
 * @param {any} project project
 * @returns {string} HTML
 */
function videoView(project) {
  const fragments = project.episodes.flatMap((episode) => episode.fragments || []);
  const done = fragments.filter((fragment) => fragment.videoStatus === 'done').length;
  return `<section class="card"><div class="card-header"><h2 class="card-title">视频生成</h2><button class="btn btn-secondary" data-action="toggle-video-panel">片段管理</button></div><p class="muted">${project.episodes.length} 集，共 ${fragments.length} 个片段，已完成 ${done} 个。</p><div class="card-actions"><button class="btn btn-primary" data-action="generate-videos">生成未完成片段</button><button class="btn btn-secondary" data-action="merge-videos">合并全部片段</button></div><div id="taskProgress"></div></section>`;
}

/** Renders active workflow content.
 * @returns {void}
 */
export function renderContent() {
  const project = currentProject();
  const container = document.querySelector('#dynamicContent');
  if (!project) return;
  const views = {
    idea: () => ideaView(project),
    plot: () => textView('plot', '分集剧情', 'script', project),
    script: () => textView('script', '分镜脚本', 'keyframes', project),
    keyframes: () => keyframesView(project),
    video: () => videoView(project),
  };
  container.innerHTML = views[state.currentStep]();
  container.querySelectorAll('.progressive img').forEach((image) => {
    const markLoaded = () => image.closest('.progressive')?.classList.add('is-loaded');
    image.complete ? markLoaded() : image.addEventListener('load', markLoaded, { once: true });
  });
}

/** Renders the fragment side panel.
 * @returns {void}
 */
export function renderVideoPanel() {
  const panel = document.querySelector('#videoPanel');
  panel.classList.toggle('open', state.videoPanelOpen);
  const project = currentProject();
  document.querySelector('#videoPanelBody').innerHTML = project?.episodes?.map((episode, episodeIndex) => `<section class="fragment-episode"><h3 class="fragment-episode-title">第 ${episode.index} 集 · ${escapeHtml(episode.title)}</h3>${episode.fragments.map((fragment, fragmentIndex) => `<div class="fragment-item"><span class="fragment-index">${fragmentIndex + 1}</span><span class="fragment-summary">${escapeHtml(fragment.label)}</span><span class="fragment-status ${fragment.videoStatus}">${({ idle: '等待', generating: '生成中', done: '完成', error: '失败' })[fragment.videoStatus]}</span><span class="fragment-actions">${fragment.videoUrl ? `<button class="btn btn-xs btn-primary" data-action="play-video" data-url="${escapeHtml(fragment.videoUrl)}">播放</button>` : ''}<button class="btn btn-xs btn-secondary" data-action="regenerate-video" data-episode="${episodeIndex}" data-fragment="${fragmentIndex}">重做</button></span>${fragment.videoError ? `<small class="error-text">${escapeHtml(fragment.videoError)}</small>` : ''}</div>`).join('')}</section>`).join('') || '<div class="empty-state">暂无视频片段</div>';
}

/** Renders all project UI.
 * @returns {void}
 */
export function renderAll() {
  const project = currentProject();
  document.querySelector('#projectNameInput').value = project?.name || '';
  document.querySelectorAll('[data-orient]').forEach((button) => button.classList.toggle('active', button.dataset.orient === project?.orientation));
  renderProjects();
  renderSteps();
  renderContent();
  renderVideoPanel();
}

/** Shows progress in the active card.
 * @param {string} label progress label
 * @param {number} completed completed count
 * @param {number} total total count
 * @returns {void}
 */
export function progress(label, completed, total) {
  const element = document.querySelector('#taskProgress');
  if (!element) return;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  element.innerHTML = `<div class="loading-pulse">${escapeHtml(label)} ${completed}/${total}</div><div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>`;
}

/** Opens a local video in a modal.
 * @param {string} url video URL
 * @returns {void}
 */
export function playVideo(url) {
  const modal = document.querySelector('#videoModal');
  modal.innerHTML = `<div class="video-player-wrapper"><video src="${escapeHtml(url)}" controls autoplay playsinline preload="metadata"></video><button class="modal-close-btn" data-action="close-video">关闭</button></div>`;
  modal.style.display = 'flex';
}

