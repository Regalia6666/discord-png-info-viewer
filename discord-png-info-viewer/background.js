// 拡張機能がインストールされた時にコンテキストメニューを作成
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "png-info-viewer",
    title: "png-info-viewer で情報を表示",
    contexts: ["image"]
  });
});

// コンテキストメニューがクリックされた時の処理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "png-info-viewer") {
    const imageUrl = info.srcUrl;
    if (!imageUrl) return;

    try {
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
        px: `${pngData.width || '不明'} x ${pngData.height || '不明'}`,
        fileSize: formatBytes(fileSize),
        fileName: fileName,
        generalInfo: generalInfoString, // 汎用表示用データ
        sdInfo: sdInfo // SD表示用データ
      };

      // content.jsにオブジェクトを送信してダイアログ表示を依頼
      chrome.tabs.sendMessage(tab.id, {
        action: "showPngInfo",
        data: displayData
      });

    } catch (error) {
      console.error("画像情報の取得/解析に失敗しました:", error);
      chrome.tabs.sendMessage(tab.id, {
        action: "showPngInfo",
        data: {
          isError: true,
          message: `画像情報の取得/解析に失敗しました。\n\nURL: ${imageUrl}\nエラー: ${error.message}`
        }
      });
    }
  }
});

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


// (parsePng と formatBytes 関数は変更なし)
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