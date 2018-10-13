const getStorageData = key => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, value => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(value[key]);
      }
    });
  });
};

const setStorageData = (key, value) => {
  return new Promise((resolve, reject) => {
    // 変数の値をキーとして使いたいときは、ブラケットでくくる必要がある
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    })
  });
};

chrome.runtime.onInstalled.addListener(async () => {
  const storageData = await getStorageData("ChannelNameList");

  if (!storageData) {
    await setStorageData("ChannelNameList", []);
  }
});
