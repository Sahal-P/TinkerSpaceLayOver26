export const THEME_STORAGE_KEY = "local-to-lens-theme";

// Static code only: validate storage before applying it, and tolerate blocked storage.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})()`;
