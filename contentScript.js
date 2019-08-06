const createElementFromHTML = htmlString => {
  var e = document.createElement('div');
  e.innerHTML = htmlString.trim();
  return e.firstChild; 
};

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

CommentAccessor = function(node) {
  this.node = node;
};

CommentAccessor.prototype.getAuthorName = function() {
  return this.node.querySelector("#author-name").textContent.trim();
}

CommentAccessor.prototype.getMessage = function() {
  let message = "";
  this.node.querySelector("#message").childNodes.forEach(child => {
    if (child.nodeName.toLowerCase() === "#text") {
      message += child.wholeText;
    }
    if (child.nodeName.toLowerCase() === "img") {
      message += `<img src=${child.src} alt=${child.alt} style="width: 24px; height: 24px;"/>`;
    }
    if (child.nodeName.toLowerCase() === "a") {
      message += `<a href=${child.href}>${child.textContent}</a>`;
    }
  });

  return message;
};

CommentAccessor.prototype.getTimestamp = function() {
  return this.node.querySelector("#timestamp").textContent;
}

CommentAccessor.prototype.getIconUrl = function() {
  return this.node.querySelector("#img").attributes["src"].value;
}

CommentAccessor.prototype.isModerator = function() {
  return this.node.attributes["author-type"].value === "moderator";
}

const init = async() => {
  // コメント抽出対象
  const channelNameList = await getStorageData("ChannelNameList");
  // モデレーターをピックアップするかどうか
  const pickupModerator = await getStorageData("PickupModerator");

  // ピックアップしたコメントを表示するコメント欄を生成する
  const pickupCommentBoxHtmlStr = `
    <div style="width: 100vw; height: 20vh; position: absolute;">
      <div style="width: 100%; height: 20%; position: absolute; background-color: hsla(0, 0%, 93.3%, .4)">
        <span style="font-size: 1.6rem;">ピックアップコメント</span>
      </div>
      <div id="ycp-move-to-bottom-button-block" style="display: block; width: 100%; height: 37px; bottom: 5px; position: absolute; text-align: center; z-index: 1; visibility: hidden;">
        <button id="ycp-move-to-bottom-button" style="background:#2196f3; border:0; border-radius:999px; width:32px; height:32px; cursor: pointer;" disabled>
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid meet" fill="#FFFFFF" viewBox="0 0 640 640" style="display: block; width: 100%; height: 100%;">
            <defs>
              <path d="M281.69 30L351.69 30L351.69 580L281.69 580L281.69 30Z" id="bFv2yIG5"></path>
              <path d="M542.6 295.81L592.1 345.31L317.4 620L267.9 570.5L542.6 295.81Z" id="b4GDdYaZqg"></path>
              <path d="M47.31 350.31L96.81 300.81L366.5 570.5L317 620L47.31 350.31Z" id="b5oUeVg54h"></path>
            </defs>
            <g>
              <use xlink:href="#bFv2yIG5" opacity="1" fill-opacity="1"></use>
              <use xlink:href="#b4GDdYaZqg" opacity="1" fill-opacity="1"></use>
              <use xlink:href="#b5oUeVg54h" opacity="1" fill-opacity="1"></use>
            </g>
          </svg>
        </button>
      </div>
      <div id="ycp-comment-list" style="width: 100%; height: 80%; top: 20%; position: absolute; overflow-x: hidden; overflow-y: scroll;"/>
    </div>`;
  const pickupCommentBox = createElementFromHTML(pickupCommentBoxHtmlStr);
  const pickupCommentList = pickupCommentBox.querySelector("#ycp-comment-list");
  const moveToBottomButtonBlock = pickupCommentBox.querySelector("#ycp-move-to-bottom-button-block");
  const moveToBottomButton = pickupCommentBox.querySelector("#ycp-move-to-bottom-button");

  let autoScroll = true;

  // コメント最新へ移動するボタン
  // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTop
  moveToBottomButton.addEventListener('click', () => {
    moveToBottomButton.disabled = true;
    moveToBottomButtonBlock.style.visibility = "hidden";
    pickupCommentList.scrollTop = Number.MAX_SAFE_INTEGER;
  });

  pickupCommentList.addEventListener('scroll', () => {
    // カーソルが最新のコメントの領域に差し掛かっているかどうかをチェックする
    // 参考: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollHeight
    const isCursorBottom = pickupCommentList.scrollTop === (pickupCommentList.scrollHeight - pickupCommentList.clientHeight);

    if (isCursorBottom) {
      autoScroll = true;
      if (!moveToBottomButton.disabled) {
        moveToBottomButton.disabled = true;
        moveToBottomButtonBlock.style.visibility = "hidden";
      }
    } else {
      autoScroll = false;
      if (moveToBottomButton.disabled) {
        moveToBottomButton.disabled = false;
        moveToBottomButtonBlock.style.visibility = "visible";
      }
    }
  });

  // 通常コメント欄上部に配置されるよう、最初の要素として追加する
  document.body.insertBefore(pickupCommentBox, document.body.firstChild);

  // ピックアップコメント欄と通常コメント欄を 2:8 の割合で表示するため、
  // 通常コメント欄のサイズを調整する
  document.querySelector('yt-live-chat-app').style.position = "absolute";
  document.querySelector('yt-live-chat-app').style.top = "20vh";
  document.querySelector('yt-live-chat-app').style.height = "80vh";

  // https://developer.mozilla.org/ja/docs/Web/API/MutationObserver
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      // 追加されたノードを調査する
      record.addedNodes.forEach(node => { 
        // コメントノードかどうかをチェックする
        if (node.nodeName.toLowerCase() !== "yt-live-chat-text-message-renderer") {
          return;
        }

        const accessor = new CommentAccessor(node);
        const authorName = accessor.getAuthorName();
        const isModerator = accessor.isModerator();

        if (channelNameList.indexOf(authorName) >= 0 || (pickupModerator && isModerator))
        {
          // 残りの要素抽出
          // 絵文字を対処する
          const message = accessor.getMessage();
          const timestamp = accessor.getTimestamp();
          const iconUrl = accessor.getIconUrl();
          //console.log(`${timestamp} ${authorName} ${message} ${iconUrl} ${moderator}`);

          const newCommentHtmlStr = `
            <div id="ycp-comment" style="display: flex; flex-direction: row; margin: 4px 4px; background-color: transparent; transition: background 1s ease 0s;">
              <img id="ycp-comment-icon" style="border-radius: 20px; height: 32px; width: 32px; margin-right: 16px;" src=${iconUrl} />
              <div style="align-self: center;">
                  <span id="ycp-comment-timestamp" style="font-size: 11px; margin-right: 8px; color: hsla(0, 0%, 6.7%, .4)">${timestamp}</span>
                  <span id="ycp-comment-authorname" style="font-size: 13px; margin-right: 8px; color: hsla(0, 0%, 6.7%, .6);">${authorName}</span>
                  <span id="ycp-comment-message" style="font-size: 13px; line-height: 16px; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word; color: hsl(0, 0%, 6.7%)">${message}</span>
              </div>
            </div>
          `;
          const newComment = createElementFromHTML(newCommentHtmlStr);

          const found = Array.prototype.find.call(pickupCommentList.querySelectorAll("#ycp-comment"), child => {
            return child.querySelector("#ycp-comment-timestamp").innerHTML === newComment.querySelector("#ycp-comment-timestamp").innerHTML &&
                child.querySelector("#ycp-comment-authorname").innerHTML === newComment.querySelector("#ycp-comment-authorname").innerHTML &&
                child.querySelector("#ycp-comment-message").innerHTML === newComment.querySelector("#ycp-comment-message").innerHTML;
          });
          if (found !== undefined) {
            // 同一のコメントのため、追加しない。
            return;
          }

          const flushAnimation = () => {
            if (newComment.style.backgroundColor === "transparent") {
              newComment.style.backgroundColor = "#FF4500";
            } else {
              newComment.style.backgroundColor = "transparent";
            }
          };

          setTimeout(() => {
            flushAnimation();

            let count = 4;
            const timer = setInterval(() => {
              flushAnimation();

              if (count-- <= 0) {
                clearInterval(timer);
              }
            }, 1000);
          }, 100);

          // コメント追加
          pickupCommentList.appendChild(newComment);

          if (autoScroll) {
            // カーソルを最新へ自動スクロール
            pickupCommentList.scrollTop = Number.MAX_SAFE_INTEGER;

            // appendChild は（おそらく）非同期的であり、scrollTop の書き換え後に appendChild が完了してしまうと、最新のコメントまでスクロールしきれない問題が発生する。
            // このため、適当な時間を開けて値の再設定を行います。
            setTimeout(() => {
              pickupCommentList.scrollTop = Number.MAX_SAFE_INTEGER;
            }, 16);
          }
        }
      })
    })
  });
  
  // チャット欄への変更を監視する
  observer.observe(document.querySelector('yt-live-chat-app'), {
    childList: true,  // 対象ノードと子ノードへの追加、削除を監視する
    subtree: true,  // 対象ノードと子ノードへの変更を監視する
  });
};
init();
