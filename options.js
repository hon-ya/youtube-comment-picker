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
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    })
  });
};

const init = async () => {
  const channelNameList = await getStorageData("ChannelNameList");
  const channelNameListTextArea = document.querySelector("#channel-name-list");
  channelNameListTextArea.value = channelNameList.join("\n");

  const pickupModerator = await getStorageData("PickupModerator");
  const pickupModeratorBlock = document.querySelector("#pickup-moderator-block");
  if (pickupModerator) {
    pickupModeratorBlock.MaterialCheckbox.check();
  } else {
    pickupModeratorBlock.MaterialCheckbox.uncheck();
  }

  const saveButton = document.querySelector("#save-button");
  saveButton.addEventListener('click', async () => {
    await setStorageData("ChannelNameList", channelNameListTextArea.value.split('\n'));
    await setStorageData("PickupModerator", pickupModeratorBlock.classList.contains("is-checked"));
    const data = {
      message: "保存しました。",
      timeout: 1000,
    };
    document.querySelector("#saved-toast").MaterialSnackbar.showSnackbar(data);
  });
};
init();
