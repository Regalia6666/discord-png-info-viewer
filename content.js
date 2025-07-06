// background.jsからのメッセージを待つリスナー
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "processImage") {
    const imageUrl = request.imageUrl;
    // 既存のダイアログを削除
    const existingDialog = document.getElementById('png-info-viewer-overlay');
    if (existingDialog) {
      existingDialog.remove();
    }

    try {
      // content.js内で画像をfetch
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileSize = arrayBuffer.byteLength;
      const pngData = parsePng(new Uint8Array(arrayBuffer));
      const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1).split('?')[0].split('#')[0] || "ファイル名不明";

      // 汎用表示用のデータを作成
      const generalInfoString = pngData.tEXt.length > 0
        ? pngData.tEXt.map(item => `[${item.keyword}]\n${item.text}`).join('\n\n')
        : '(tEXtチャンクは見つかりませんでした)';

      // SD特化表示用のデータを解析・作成
      const sdInfo = parseSdInfo(pngData.tEXt);

      // 表示するデータを構造化されたオブジェクトとして準備
      const displayData = {
        px: `${pngData.width || '不明'} x ${pngData.height || '不明'} `,
        fileSize: formatBytes(fileSize),
        fileName: fileName,
        generalInfo: generalInfoString, // 汎用表示用データ
        sdInfo: sdInfo // SD表示用データ
      };

      // ダイアログを表示
      showPngInfoDialog(displayData);

    } catch (error) {
      console.error("画像情報の取得/解析に失敗しました:", error);
      showPngInfoDialog({
        isError: true,
        message: `画像情報の取得/解析に失敗しました。\n\nURL: ${imageUrl}\nエラー: ${error.message}`
      });
    }
  }
});

/**
 * PNG情報表示ダイアログを生成・表示する
 * @param {object} data - 表示するデータ
 */
function showPngInfoDialog(data) {
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

// --- background.jsから移植した関数群 ---

/**
 * Stable Diffusion Web UIの生成情報を解析する
 * @param {Array<{keyword: string, text: string}>} tEXtChunks - tEXtチャンクの配列
 * @returns {{prompt: string, negativePrompt: string, otherParams: string, others: Array<string>}}
 */
function parseSdInfo(tEXtChunks) {
  const result = {
    prompt: '',
    negativePrompt: '',
    otherParams: '',
    others: []
  };

  // AUTOMATIC1111/stable-diffusion-webui が生成する 'parameters' チャンクを探す
  const parametersChunk = tEXtChunks.find(c => c.keyword === 'parameters');

  if (parametersChunk) {
    const text = parametersChunk.text;
    const negPromptKeyword = 'Negative prompt:';
    const paramsKeyword = 'Steps:';

    const negPromptIndex = text.indexOf(negPromptKeyword);
    const paramsIndex = text.indexOf(paramsKeyword);

    if (negPromptIndex !== -1) {
      // Negative prompt がある場合
      result.prompt = text.substring(0, negPromptIndex).trim();
      if (paramsIndex !== -1) {
        // Parameters もある場合
        result.negativePrompt = text.substring(negPromptIndex + negPromptKeyword.length, paramsIndex).trim();
        result.otherParams = text.substring(paramsIndex).trim().replace(/, /g, '\n');
      } else {
        // Negative prompt のみある場合
        result.negativePrompt = text.substring(negPromptIndex + negPromptKeyword.length).trim();
      }
    } else if (paramsIndex !== -1) {
      // Negative prompt はないが Parameters はある場合
      result.prompt = text.substring(0, paramsIndex).trim();
      result.otherParams = text.substring(paramsIndex).trim().replace(/, /g, '\n');
    } else {
      // Prompt しかない場合
      result.prompt = text.trim();
    }
  } else {
    // 'parameters' チャンクがない場合、個別のキーワードを探す (フォールバック)
    const promptChunk = tEXtChunks.find(c => c.keyword.toLowerCase() === 'prompt');
    if (promptChunk) result.prompt = promptChunk.text;

    const negPromptChunk = tEXtChunks.find(c => c.keyword.toLowerCase() === 'negative prompt');
    if (negPromptChunk) result.negativePrompt = negPromptChunk.text;
  }

  // 'parameters', 'prompt', 'negative prompt' 以外のチャンクを 'others' に格納
  result.others = tEXtChunks
    .filter(c => c.keyword !== 'parameters' && c.keyword.toLowerCase() !== 'prompt' && c.keyword.toLowerCase() !== 'negative prompt')
    .map(item => `[${item.keyword}]\n${item.text}`);

  return result;
}

function parsePng(bytes) {
  const dataView = new DataView(bytes.buffer);
  if (dataView.getUint32(0) !== 0x89504E47 || dataView.getUint32(4) !== 0x0D0A1A0A) {
    console.log('PNGシグネチャが見つかりませんでした。JPEGなどの可能性があります。');
    return { width: null, height: null, tEXt: [] };
  }
  const result = { width: null, height: null, tEXt: [] };
  const decoder = new TextDecoder('iso-8859-1');
  let offset = 8;
  while (offset < bytes.length) {
    const length = dataView.getUint32(offset);
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8));
    const chunkDataOffset = offset + 8;
    if (type === 'IHDR') {
      result.width = dataView.getUint32(chunkDataOffset);
      result.height = dataView.getUint32(chunkDataOffset + 4);
    } else if (type === 'tEXt') {
      const chunkData = bytes.slice(chunkDataOffset, chunkDataOffset + length);
      const nullSeparatorIndex = chunkData.indexOf(0);
      if (nullSeparatorIndex > 0) {
        const keyword = decoder.decode(chunkData.slice(0, nullSeparatorIndex));
        const text = decoder.decode(chunkData.slice(nullSeparatorIndex + 1));
        result.tEXt.push({ keyword, text });
      }
    } else if (type === 'IEND') {
      break;
    }
    offset += 4 + 4 + length + 4;
  }
  return result;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
