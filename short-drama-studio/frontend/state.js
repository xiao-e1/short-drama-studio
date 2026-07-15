const PROJECTS_KEY = 'short_drama_studio_projects_v3';
const CURRENT_KEY = 'short_drama_studio_current_v3';

/** @typedef {{id:string,name:string,orientation:'portrait'|'landscape',createdAt:number,updatedAt:number,steps:Record<string,any>,episodes:Array<any>}} Project */

export const state = {
  /** @type {Record<string, Project>} */ projects: {},
  /** @type {string|null} */ currentProjectId: null,
  currentStep: 'idea',
  videoPanelOpen: false,
  /** @type {AbortController|null} */ activeAbort: null,
};

/** Creates a reasonably unique browser-side ID.
 * @returns {string} ID
 */
export function createId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns the active project.
 * @returns {Project|null} project
 */
export function currentProject() {
  return state.projects[state.currentProjectId] || null;
}

/** Loads projects from localStorage.
 * @returns {void}
 */
export function loadState() {
  try {
    const currentProjects = localStorage.getItem(PROJECTS_KEY);
    const legacyProjects = localStorage.getItem('drama_workshop_v2_projects');
    state.projects = JSON.parse(currentProjects || legacyProjects || '{}');
    state.currentProjectId = localStorage.getItem(CURRENT_KEY) || localStorage.getItem('drama_workshop_v2_currentId') || null;
    if (!currentProjects && legacyProjects) saveState();
  } catch {
    state.projects = {};
    state.currentProjectId = null;
  }
}

/** Persists current project state.
 * @returns {void}
 */
export function saveState() {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(state.projects));
  localStorage.setItem(CURRENT_KEY, state.currentProjectId || '');
}

/** Creates and selects a blank project.
 * @returns {Project} project
 */
export function createProject() {
  const id = createId();
  const now = Date.now();
  state.projects[id] = { id, name: '未命名项目', orientation: 'portrait', createdAt: now, updatedAt: now, steps: {}, episodes: [] };
  state.currentProjectId = id;
  state.currentStep = 'idea';
  state.videoPanelOpen = false;
  saveState();
  return state.projects[id];
}

/** Sets step data and persists it.
 * @param {string} key step key
 * @param {any} value step value
 * @returns {void}
 */
export function setStep(key, value) {
  const project = currentProject();
  if (!project) return;
  project.steps[key] = value;
  project.updatedAt = Date.now();
  saveState();
}

/** Deletes a project.
 * @param {string} id project ID
 * @returns {void}
 */
export function removeProject(id) {
  delete state.projects[id];
  state.currentProjectId = Object.keys(state.projects)[0] || null;
  if (!state.currentProjectId) createProject();
  saveState();
}

/** Removes all locally saved projects.
 * @returns {void}
 */
export function clearProjects() {
  localStorage.removeItem(PROJECTS_KEY);
  localStorage.removeItem(CURRENT_KEY);
  state.projects = {};
  state.currentProjectId = null;
  createProject();
}
