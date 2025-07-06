// background.jsからのメッセージを待つリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "showPngInfo") {
    // 既存のダイアログを削除
    const existingDialog = document.getElementById('png-info-viewer-overlay');
    if (existingDialog) {
      existingDialog.remove();
    }

    const data = request.data;
    const overlay = document.createElement('div');
    overlay.id = 'png-info-viewer-overlay';
    
    const dialog = document.createElement('div');
    dialog.id = 'png-info-viewer-dialog';

    // --- ダイアログの内容を生成 ---
    if (data.isError) {
      // エラーの場合
      const errorDiv = document.createElement('div');
      errorDiv.className = 'piv-error';
      errorDiv.textContent = data.message;
      dialog.appendChild(errorDiv);
    } else {
      // 通常表示の場合

      // --- ヘッダー情報 (共通) ---
      const headerContainer = document.createElement('div');
      headerContainer.appendChild(createKeyValueBlock('px数', data.px));
      headerContainer.appendChild(createKeyValueBlock('ファイルサイズ', data.fileSize));
      headerContainer.appendChild(createKeyValueBlock('ファイル名', data.fileName));
      dialog.appendChild(headerContainer);

      // --- トグルボタン ---
      const toggleContainer = document.createElement('div');
      toggleContainer.className = 'piv-toggle-container';
      
      const btnGeneral = document.createElement('button');
      btnGeneral.className = 'piv-toggle-btn active';
      btnGeneral.textContent = '汎用表示';
      
      const btnSd = document.createElement('button');
      btnSd.className = 'piv-toggle-btn';
      btnSd.textContent = 'SD表示';

      toggleContainer.appendChild(btnGeneral);
      toggleContainer.appendChild(btnSd);
      dialog.appendChild(toggleContainer);

      // --- 区切り線 ---
      const hr = document.createElement('hr');
      hr.className = 'piv-hr';
      dialog.appendChild(hr);

      // --- コンテンツエリア ---
      const contentArea = document.createElement('div');
      
      // 汎用表示コンテンツ
      const generalContent = document.createElement('div');
      generalContent.appendChild(createTextBlock('tEXt', data.generalInfo));
      
      // SD特化表示コンテンツ
      const sdContent = document.createElement('div');
      sdContent.style.display = 'none'; // 初期状態は非表示

      const sdInfo = data.sdInfo;
      if (sdInfo.prompt) {
        sdContent.appendChild(createTextBlock('Prompt', sdInfo.prompt));
      }
      if (sdInfo.negativePrompt) {
        sdContent.appendChild(createTextBlock('Negative Prompt', sdInfo.negativePrompt));
      }
      if (sdInfo.otherParams) {
        sdContent.appendChild(createTextBlock('Parameters', sdInfo.otherParams));
      }
      if (sdInfo.others.length > 0) {
        sdContent.appendChild(createTextBlock('その他のtEXt情報', sdInfo.others.join('\n\n')));
      }
      if (!sdInfo.prompt && !sdInfo.negativePrompt && !sdInfo.otherParams && sdInfo.others.length === 0) {
        sdContent.appendChild(createTextBlock('SD情報', '(Stable Diffusion関連の情報は見つかりませんでした)'));
      }

      contentArea.appendChild(generalContent);
      contentArea.appendChild(sdContent);
      dialog.appendChild(contentArea);

      // トグルボタンのイベントリスナー
      btnGeneral.addEventListener('click', () => {
        btnGeneral.classList.add('active');
        btnSd.classList.remove('active');
        generalContent.style.display = 'block';
        sdContent.style.display = 'none';
      });

      btnSd.addEventListener('click', () => {
        btnSd.classList.add('active');
        btnGeneral.classList.remove('active');
        sdContent.style.display = 'block';
        generalContent.style.display = 'none';
      });
    }
    // --- 生成完了 ---

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // クリックまたはESCキーで閉じるイベント
    const closeDialog = (e) => {
      if (e.target === overlay || e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', closeDialog);
      }
    };
    overlay.addEventListener('click', closeDialog);
    document.addEventListener('keydown', closeDialog);
  }
});

// ヘルパー関数: ラベルと値のペア表示 (px数など)
function createKeyValueBlock(labelText, valueText) {
  const section = document.createElement('div');
  section.className = 'piv-section';

  const label = document.createElement('div');
  label.className = 'piv-label';
  label.textContent = labelText;

  const value = document.createElement('div');
  value.className = 'piv-value';
  value.textContent = valueText;

  section.appendChild(label);
  section.appendChild(value);
  return section;
}

// ヘルパー関数: ラベル付きのテキストブロック表示 (プロンプトなど)
function createTextBlock(labelText, valueText) {
  const section = document.createElement('div');
  
  const label = document.createElement('div');
  label.className = 'piv-label-block';
  label.textContent = labelText;
  
  const value = document.createElement('div');
  value.className = 'piv-text-block';
  value.textContent = valueText;
  
  section.appendChild(label);
  section.appendChild(value);
  return section;
}