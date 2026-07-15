/** Escapes text for safe HTML interpolation.
 * @param {unknown} value input value
 * @returns {string} escaped string
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

/** Extracts a title from generated prose.
 * @param {string} plot plot text
 * @returns {string} title
 */
export function extractTitle(plot = '') {
  const match = plot.match(/【(.+?)】|剧名[：:]\s*(.+)/);
  return (match?.[1] || match?.[2] || '未命名短剧').trim();
}

/** Extracts stable character details from plot/script.
 * @param {string} script script text
 * @param {string} plot plot text
 * @returns {{name:string,description:string}} character
 */
export function extractCharacter(script = '', plot = '') {
  const text = `${plot}\n${script}`;
  const match = text.match(/(?:主角|男主|女主|男主角|女主角)[：:]\s*([^，,\n]{2,20})[，,]\s*([^。\n]{5,100})/);
  return match ? { name: match[1].trim(), description: match[2].trim() } : { name: '主角', description: '请严格沿用关键帧中的脸型、发型、年龄、服装与配饰' };
}

/** Parses scenes from generated script text.
 * @param {string} script script text
 * @returns {Array<{label:string,description:string}>} scenes
 */
export function parseScenes(script = '') {
  const lines = script.split('\n');
  const scenes = [];
  for (const line of lines) {
    const match = line.match(/(?:场景|镜头|分镜)\s*\d*[：:]\s*(.+)/i);
    if (match?.[1]?.trim()) scenes.push({ label: `场景 ${scenes.length + 1}`, description: match[1].trim().slice(0, 400) });
  }
  if (!scenes.length) {
    script.split(/\n\s*\n/).filter((part) => part.trim().length > 20).slice(0, 30).forEach((part, index) => scenes.push({ label: `场景 ${index + 1}`, description: part.trim().slice(0, 400) }));
  }
  return scenes;
}

/** Builds a context-rich video prompt for visual continuity.
 * @param {import('./state.js').Project|any} project project
 * @param {number} episodeIndex episode index
 * @param {number} fragmentIndex fragment index
 * @returns {string} video prompt
 */
export function buildVideoPrompt(project, episodeIndex, fragmentIndex) {
  const episode = project.episodes[episodeIndex];
  const fragment = episode.fragments[fragmentIndex];
  const character = project.character || extractCharacter(project.steps.script, project.steps.plot);
  const previous = fragmentIndex > 0
    ? episode.fragments[fragmentIndex - 1]?.description
    : project.episodes[episodeIndex - 1]?.fragments?.at(-1)?.description;
  return [
    `短剧《${project.title || extractTitle(project.steps.plot)}》，${episode.title}`,
    `完整角色设定：${character.name}，${character.description}。人物身份、年龄、脸型、发型、服装、配饰全程一致。`,
    `当前镜头：${fragment.description}`,
    `前情上下文：${previous || '故事开场，以关键帧为人物和场景基准。'}`,
    '连续性要求：严格继承输入关键帧中的人物外貌、服装、光线、场景空间和镜头方向，不新增无关人物，不改变时代与画风。',
    '镜头要求：电影化构图，动作自然，运镜稳定，主体清晰。',
  ].join('\n');
}

/** Waits for a delay.
 * @param {number} milliseconds delay
 * @returns {Promise<void>}
 */
export const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

