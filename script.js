const COMPRESSION_THRESHOLD_BYTES = 2.5 * 1024 * 1024;
const MAX_COMPRESSED_SIZE_BYTES = 20 * 1024 * 1024;
const DEFAULT_COMPRESSION_STATUS = 'Select a file to check compression.';

let currentFileState = {
    name: "video.mp4",
    sizeBytes: 45 * 1024 * 1024,
    sizeMB: "45.0 MB",
    rawSizeMB: 45.0,
    type: "video/mp4",
    dataUrl: null,
    file: null,
    iconClass: "fa-file-video",
    compressionStatus: DEFAULT_COMPRESSION_STATUS,
    compressionStatusKind: 'info',
    compressedBlob: null,
    compressionFormat: null
};

let dragCounter = 0;
let currentCompressionPromise = Promise.resolve(null);
let audioContext = null;

const DEMO_DRIVE_FILES = [
    { name: 'Coastline at dusk.jpg', type: 'image', size: '2.4 MB', imageUrl: 'https://picsum.photos/seed/drive-coastline/480/320' },
    { name: 'Forest trail.jpg', type: 'image', size: '1.8 MB', imageUrl: 'https://picsum.photos/seed/drive-forest/480/320' },
    { name: 'Notification chime.wav', type: 'audio', size: '180 KB', frequencies: [880, 1174, 1568] },
    { name: 'Arcade blip.wav', type: 'audio', size: '120 KB', frequencies: [440, 660, 880] },
    { name: 'Never Gonna Give You Up.mp3', type: 'audio-demo', size: '4.1 MB', note: 'Rickroll demo listing; audio not included.' }
];

// --- INITIALIZATION & UPLOAD TRIGGERS ---

function triggerDesktopUpload() {
    primeAudioCues();
    closeAttachmentMenu();
    closeMobileAttachmentMenu();
    document.getElementById('real-file-input').click();
}

function handleRealFileUpload(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        processUploadedFile(files[0]);
    }
    event.target.value = '';
}

function processUploadedFile(file) {
    primeAudioCues().then(() => playSoundCue('select'));
    const sizeInMB = file.size / (1024 * 1024);
    const needsCompression = file.size > COMPRESSION_THRESHOLD_BYTES;

    currentFileState = {
        name: file.name,
        sizeBytes: file.size,
        sizeMB: sizeInMB < 1 ? (file.size / 1024).toFixed(1) + " KB" : sizeInMB.toFixed(1) + " MB",
        rawSizeMB: sizeInMB,
        type: file.type,
        dataUrl: null,
        file,
        iconClass: getFileIconClass(file.name, file.type),
        compressedBlob: null,
        compressionFormat: null,
        compressionStatus: needsCompression ? 'Preparing compression…' : 'Original ready · no compression needed',
        compressionStatusKind: needsCompression ? 'processing' : 'info'
    };

    updateUIWithCurrentFile();
    triggerVisualFeedback(document.getElementById('modal-compression-feedback'));
    triggerVisualFeedback(document.getElementById('mobile-compression-feedback'));
    currentCompressionPromise = prepareFileCompression(file);

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (currentFileState.file !== file) return;
            currentFileState.dataUrl = e.target.result;
            updateUIWithCurrentFile();
        };
        reader.readAsDataURL(file);
    }

    showFileOptions();
}

function showFileOptions() {
    if (!document.getElementById('mobile-viewport').classList.contains('hidden')) {
        document.getElementById('mobile-bottom-sheet').classList.remove('hidden');
        document.getElementById('mobile-step-5').classList.remove('hidden');
    } else {
        goToSmartModal();
    }
}

function getFileIconClass(filename, mimeType) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) || mimeType.startsWith('video/')) return 'fa-file-video';
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext) || mimeType.startsWith('image/')) return 'fa-file-image';
    if (['pdf'].includes(ext)) return 'fa-file-pdf';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'fa-file-zipper';
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext) || mimeType.startsWith('audio/')) return 'fa-file-audio';
    return 'fa-file';
}

// --- UI UPDATES ---

function updateUIWithCurrentFile() {
    // Frame 1 Overlay
    document.getElementById('overlay-filename').innerText = currentFileState.name;
    document.getElementById('overlay-tooltip-text').innerHTML = `File is <strong>${currentFileState.sizeMB}</strong>. Release to choose how to send it.`;
    document.getElementById('overlay-file-icon').innerHTML = `<i class="fa-solid ${currentFileState.iconClass}"></i>`;

    // Frame 2 Modal
    document.getElementById('modal-file-name').innerText = currentFileState.name;
    document.getElementById('modal-orig-size').innerText = currentFileState.sizeMB;
    const compressionNote = getCompressionNote();
    document.getElementById('compression-note').innerText = compressionNote;
    updateCompressionEstimate();

    const thumbBox = document.getElementById('modal-file-thumbnail');
    if (currentFileState.dataUrl && currentFileState.type.startsWith('image/')) {
        thumbBox.innerHTML = `<img src="${currentFileState.dataUrl}" alt="" class="w-full h-full object-cover"><div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-discord-green text-white flex items-center justify-center text-xs shadow-md font-bold"><i class="fa-solid fa-check"></i></div>`;
    } else if (currentFileState.dataUrl && currentFileState.type.startsWith('video/')) {
        thumbBox.innerHTML = `<video src="${currentFileState.dataUrl}" class="w-full h-full object-cover"></video><div class="absolute inset-0 flex items-center justify-center"><i class="fa-solid fa-play text-white/90 text-2xl drop-shadow-md"></i></div><div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-discord-green text-white flex items-center justify-center text-xs shadow-md font-bold"><i class="fa-solid fa-check"></i></div>`;
    } else {
        thumbBox.innerHTML = `<i class="fa-solid ${currentFileState.iconClass} text-discord-brand text-4xl"></i><div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-discord-green text-white flex items-center justify-center text-xs shadow-md font-bold"><i class="fa-solid fa-check"></i></div>`;
    }

    // Mobile Sync
    document.getElementById('mobile-preview-name').innerText = currentFileState.name;
    updateCompressionEstimate();
    document.getElementById('mobile-compression-note').innerText = compressionNote;
    document.getElementById('mobile-preview-box').innerHTML = thumbBox.innerHTML;
}

function getCompressionNote() {
    if (!currentFileState.file) {
        return 'Files are compressed on your device when it can reduce their size. Compressed files must be 20 MB or smaller.';
    }
    if (currentFileState.sizeBytes <= COMPRESSION_THRESHOLD_BYTES) {
        return 'This file does not need compression and will be sent as-is.';
    }
    return currentFileState.type.startsWith('image/')
        ? 'This image will be converted to WebP on your device, which may reduce image quality. Compressed files over 20 MB cannot be sent.'
        : 'GZIP compression is attempted on your device. Compressed files over 20 MB cannot be sent.';
}

function updateCompressionEstimate() {
    const statusIcons = {
        info: 'fa-circle-info',
        processing: 'fa-spinner fa-spin',
        success: 'fa-circle-check',
        warning: 'fa-triangle-exclamation',
        error: 'fa-circle-exclamation'
    };
    const statusKind = currentFileState.compressionStatusKind || 'info';
    const statusText = currentFileState.compressionStatus || DEFAULT_COMPRESSION_STATUS;

    document.getElementById('modal-compressed-size').textContent = statusText;
    document.getElementById('mobile-preview-compressed').textContent = statusText;
    document.getElementById('modal-compressed-size').className = `font-semibold compression-status-${statusKind}`;
    document.getElementById('mobile-preview-compressed').className = `compression-status-${statusKind}`;
    for (const [id, buttonId] of [
        ['modal-compression-icon', 'desktop-compress-button'],
        ['mobile-compression-icon', 'mobile-compress-button']
    ]) {
        const icon = document.getElementById(id);
        icon.className = `compression-status-icon compression-status-${statusKind}`;
        icon.innerHTML = `<i class="fa-solid ${statusIcons[statusKind]}" aria-hidden="true"></i>`;
        const button = document.getElementById(buttonId);
        const canSendCompressed = statusKind === 'success';
        button.disabled = !canSendCompressed;
        button.className = `compression-send-button ${canSendCompressed ? 'compression-send-button-ready' : 'compression-send-button-disabled'}`;
    }
    document.getElementById('modal-compressed-size').setAttribute('aria-busy', String(statusKind === 'processing'));
    document.getElementById('mobile-preview-compressed').setAttribute('aria-busy', String(statusKind === 'processing'));
    document.getElementById('desktop-send-original-button').disabled = statusKind === 'processing';
    document.getElementById('mobile-send-original-button').disabled = statusKind === 'processing';
    updateWorkflowIndicators(statusKind, statusText);
}

function updateWorkflowIndicators(statusKind, statusText) {
    const hasFile = Boolean(currentFileState.file);
    const progress = !hasFile ? 0 : statusKind === 'processing' ? null : 100;
    const statusLabels = {
        waiting: 'Waiting for a file',
        info: 'File ready',
        processing: 'Optimizing file',
        success: 'Compression complete',
        warning: 'Original ready',
        error: 'Check file status'
    };
    const workflowStatus = hasFile ? statusKind : 'waiting';

    for (const prefix of ['modal', 'mobile']) {
        const track = document.getElementById(`${prefix}-file-progress`);
        const showProgress = hasFile && (statusKind === 'processing' || statusKind === 'success');
        track.hidden = !showProgress;
        track.className = `file-progress-track compression-status-${workflowStatus}${statusKind === 'processing' && hasFile ? ' is-indeterminate' : ''}`;
        track.setAttribute('aria-valuetext', hasFile ? `${statusLabels[statusKind]}: ${statusText}` : statusLabels.waiting);
        if (progress === null) {
            track.removeAttribute('aria-valuenow');
        } else {
            track.setAttribute('aria-valuenow', String(progress));
        }

        const selected = document.getElementById(`${prefix}-step-selected`);
        const optimize = document.getElementById(`${prefix}-step-optimize`);
        const ready = document.getElementById(`${prefix}-step-ready`);
        selected.className = `workflow-step${hasFile ? ' is-complete' : ''}`;
        optimize.className = !hasFile
            ? 'workflow-step'
            : statusKind === 'processing'
            ? 'workflow-step is-current'
            : statusKind === 'error'
                ? 'workflow-step is-error'
                : statusKind === 'warning'
                    ? 'workflow-step is-attention'
                    : 'workflow-step is-complete';
        ready.className = hasFile && statusKind !== 'processing' ? 'workflow-step is-complete' : 'workflow-step';
        if (hasFile && statusKind === 'info') optimize.title = 'No optimization needed';
        else optimize.removeAttribute('title');
    }
}

async function prepareFileCompression(file) {
    if (file.size <= COMPRESSION_THRESHOLD_BYTES) {
        currentFileState.compressionStatus = 'Original ready · no compression needed';
        currentFileState.compressionStatusKind = 'info';
        updateCompressionEstimate();
        triggerVisualFeedback(document.getElementById('modal-file-progress'));
        triggerVisualFeedback(document.getElementById('mobile-file-progress'));
        playSoundCue('success');
        return null;
    }

    currentFileState.compressionStatus = 'Compressing on your device…';
    currentFileState.compressionStatusKind = 'processing';
    updateCompressionEstimate();
    triggerVisualFeedback(document.getElementById('modal-compression-feedback'));
    triggerVisualFeedback(document.getElementById('mobile-compression-feedback'));
    playSoundCue('processing');

    try {
        const isImage = file.type.startsWith('image/');
        const compressedBlob = isImage
            ? await compressImageFile(file)
            : await compressWithGzip(file);
        if (currentFileState.file !== file) return null;
        currentFileState.compressedBlob = compressedBlob;
        currentFileState.compressionFormat = compressedBlob ? (isImage ? 'webp' : 'gzip') : null;
        if (compressedBlob && compressedBlob.size > MAX_COMPRESSED_SIZE_BYTES) {
            currentFileState.compressionStatus = `Too big · compressed file is ${formatFileSize(compressedBlob.size)} (20 MB max)`;
            currentFileState.compressionStatusKind = 'error';
        } else if (compressedBlob) {
            currentFileState.compressionStatus = `Ready · ${formatFileSize(compressedBlob.size)} (from ${currentFileState.sizeMB})`;
            currentFileState.compressionStatusKind = 'success';
        } else if (file.size > MAX_COMPRESSED_SIZE_BYTES) {
            currentFileState.compressionStatus = `Too big · file remains ${currentFileState.sizeMB} (20 MB max)`;
            currentFileState.compressionStatusKind = 'error';
        } else {
            currentFileState.compressionStatus = `No size reduction · original stays at ${currentFileState.sizeMB}`;
            currentFileState.compressionStatusKind = 'warning';
        }
    } catch (error) {
        if (currentFileState.file !== file) return null;
        console.error('File compression failed; the original is still available.', error);
        currentFileState.compressionStatus = file.size > MAX_COMPRESSED_SIZE_BYTES
            ? `Too big · file remains ${currentFileState.sizeMB} (20 MB max)`
            : 'Compression failed · original stays available';
        currentFileState.compressionStatusKind = 'error';
    }

    updateCompressionEstimate();
    triggerVisualFeedback(document.getElementById('modal-compression-feedback'));
    triggerVisualFeedback(document.getElementById('mobile-compression-feedback'));
    triggerVisualFeedback(document.getElementById('modal-file-progress'));
    triggerVisualFeedback(document.getElementById('mobile-file-progress'));
    playSoundCue(currentFileState.compressionStatusKind);
    return currentFileState.compressedBlob;
}

// --- NAVIGATION & FLOW CONTROLS ---

function startNormalChatState() {
    document.getElementById('frame-1-overlay').classList.add('hidden');
    document.getElementById('frame-2-modal').classList.add('hidden');
    document.getElementById('mobile-bottom-sheet').classList.add('hidden');
}

function goToSmartModal() {
    document.getElementById('frame-1-overlay').classList.add('hidden');
    document.getElementById('frame-2-modal').classList.remove('hidden');
}

// --- DRAG AND DROP LOGIC (Fixed Flickering) ---

function handleDragOver(e) {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
        document.getElementById('frame-1-overlay').classList.remove('hidden');
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        document.getElementById('frame-1-overlay').classList.add('hidden');
    }
}

function handleDrop(e) {
    e.preventDefault();
    primeAudioCues();
    dragCounter = 0;
    document.getElementById('frame-1-overlay').classList.add('hidden');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedFile(e.dataTransfer.files[0]);
    } else {
        goToSmartModal();
    }
}

// --- SENDING FILES ---

async function sendDesktopFile(compress = false) {
    if (!compress && currentFileState.compressionStatusKind === 'processing') {
        announce('Please wait for compression to finish before sending the original.');
        return;
    }

    await primeAudioCues();
    const sentFile = await getFileToSend(compress);
    if (sentFile.tooBig) {
        showTooBigFeedback(sentFile.status);
        return;
    }

    document.getElementById('frame-2-modal').classList.add('hidden');
    const resultContainer = document.getElementById('desktop-result-message');
    const newMsg = document.createElement('div');
    newMsg.className = "flex space-x-4 group hover:bg-[#2E3035]/40 -mx-4 px-4 py-1.5 rounded animate-in fade-in duration-300";
    const safeName = escapeHtml(sentFile.name);
    let previewMediaHtml = '';
    if (sentFile.dataUrl && sentFile.type.startsWith('image/')) {
        previewMediaHtml = `<img src="${sentFile.dataUrl}" alt="${safeName}" class="max-w-xs max-h-56 rounded-lg border border-discord-divider object-cover">`;
    } else if (!sentFile.compressed && sentFile.dataUrl && sentFile.type.startsWith('video/')) {
        previewMediaHtml = `<div class="w-72 bg-black rounded-lg overflow-hidden border border-discord-divider"><video src="${sentFile.dataUrl}" class="w-full h-36 object-cover" controls></video></div>`;
    } else {
        previewMediaHtml = `
            <div class="bg-discord-sidebarBg border border-discord-divider rounded-lg p-3 max-w-xs flex items-center space-x-3">
                <i class="fa-solid ${sentFile.iconClass} text-discord-brand text-2xl"></i>
                <div class="flex-1 overflow-hidden">
                    <div class="text-xs font-bold text-white truncate">${safeName}</div>
                    <div class="text-[10px] text-discord-textMuted">${sentFile.sizeLabel}</div>
                </div>
            </div>
        `;
    }

    newMsg.innerHTML = `
        <div class="w-10 h-10 rounded-full bg-discord-brand/20 text-discord-brand flex-shrink-0 flex items-center justify-center font-semibold">A</div>
        <div class="space-y-1.5 flex-1 min-w-0">
            <div class="flex items-baseline space-x-2">
                <span class="font-semibold text-discord-brand text-sm">You</span>
                <span class="text-[11px] text-discord-textMuted">Just now</span>
            </div>
            ${previewMediaHtml}
            <div class="text-[11px] text-discord-textMuted">${escapeHtml(sentFile.status)}</div>
        </div>
    `;

    resultContainer.appendChild(newMsg);
    triggerVisualFeedback(newMsg);
    triggerVisualFeedback(document.getElementById('modal-file-progress'));
    const chatContainer = document.getElementById('desktop-chat-messages');
    chatContainer.scrollTop = chatContainer.scrollHeight;
    announce(`${sentFile.name} sent. ${sentFile.status}`);
    playSoundCue(sentFile.compressed || !compress ? 'success' : 'error');
}

async function getFileToSend(compress) {
    const fileState = currentFileState;
    const compressionPromise = currentCompressionPromise;
    if (!compress) {
        return {
            dataUrl: fileState.dataUrl,
            name: fileState.name,
            sizeLabel: fileState.sizeMB,
            type: fileState.type,
            iconClass: fileState.iconClass,
            compressed: false,
            status: 'Sent original without compression.'
        };
    }

    await compressionPromise;
    const compressedBlob = fileState.compressedBlob;
    if (compressedBlob && compressedBlob.size > MAX_COMPRESSED_SIZE_BYTES) {
        return {
            name: fileState.name,
            tooBig: true,
            status: `Too big · compressed file is ${formatFileSize(compressedBlob.size)} (20 MB max).`
        };
    }

    if (!compressedBlob) {
        if (fileState.sizeBytes > MAX_COMPRESSED_SIZE_BYTES) {
            return {
                name: fileState.name,
                tooBig: true,
                status: `Too big · file remains ${fileState.sizeMB} (20 MB max).`
            };
        }
        return {
            dataUrl: fileState.dataUrl,
            name: fileState.name,
            sizeLabel: fileState.sizeMB,
            type: fileState.type,
            iconClass: fileState.iconClass,
            compressed: false,
            tooBig: false,
            status: fileState.compressionStatusKind === 'error'
                ? 'Compression failed; sent original unchanged.'
                : fileState.sizeBytes <= COMPRESSION_THRESHOLD_BYTES
                    ? 'No compression needed; sent original unchanged.'
                    : 'No size reduction; sent original unchanged.'
        };
    }

    const sizeLabel = formatFileSize(compressedBlob.size)
    return {
        dataUrl: fileState.type.startsWith('image/') ? await readBlobAsDataUrl(compressedBlob) : null,
        name: getCompressedFileName(fileState.name, fileState.compressionFormat),
        sizeLabel,
        type: compressedBlob.type,
        iconClass: fileState.iconClass,
        compressed: true,
        tooBig: false,
        status: `Compressed from ${fileState.sizeMB} to ${sizeLabel} on your device (${fileState.compressionFormat.toUpperCase()}).`
    };
}

function showTooBigFeedback(message) {
    currentFileState.compressionStatus = message;
    currentFileState.compressionStatusKind = 'error';
    updateCompressionEstimate();
    triggerVisualFeedback(document.getElementById('modal-compression-feedback'));
    triggerVisualFeedback(document.getElementById('mobile-compression-feedback'));
    announce(message);
    playSoundCue('error');
}

function getCompressedFileName(fileName, format) {
    if (format === 'gzip') return `${fileName}.gz`;
    return fileName.replace(/\.[^.]+$/, '') + '.webp';
}

async function compressImageFile(file) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();

    let compressedBlob = null;
    for (const quality of [0.82, 0.68, 0.52]) {
        compressedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
        if (compressedBlob && compressedBlob.size < file.size) break;
    }

    return compressedBlob && compressedBlob.size < file.size ? compressedBlob : null;
}

async function compressWithGzip(file) {
    if (typeof CompressionStream === 'undefined') {
        throw new Error('GZIP compression is not supported in this browser.');
    }
    const compressedStream = file.stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(compressedStream).blob();
    if (compressedBlob.size >= file.size) return null;
    return new Blob([compressedBlob], { type: 'application/gzip' });
}

function formatFileSize(sizeBytes) {
    const sizeInMB = sizeBytes / (1024 * 1024);
    return sizeInMB < 1 ? `${(sizeBytes / 1024).toFixed(1)} KB` : `${sizeInMB.toFixed(1)} MB`;
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function announce(message) {
    document.getElementById('app-announcement').textContent = message;
}

async function primeAudioCues() {
    if (!window.AudioContext) {
        announce('Audio feedback is not supported in this browser; visual status indicators remain active.');
        return;
    }

    try {
        audioContext ??= new window.AudioContext();
        if (audioContext.state === 'suspended') await audioContext.resume();
    } catch (error) {
        console.error('Unable to prepare audio feedback.', error);
        announce('Audio feedback is unavailable; visual status indicators remain active.');
    }
}

function playSoundCue(kind) {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume()
            .then(() => playSoundCue(kind))
            .catch(error => {
                console.error('Unable to play audio feedback.', error);
                announce('Audio feedback could not play; visual status indicators remain active.');
            });
        return;
    }
    if (audioContext.state !== 'running') return;

    const cues = {
        select: [{ frequency: 660, delay: 0, duration: 0.1 }],
        processing: [{ frequency: 520, delay: 0, duration: 0.09 }, { frequency: 740, delay: 0.11, duration: 0.09 }],
        success: [{ frequency: 660, delay: 0, duration: 0.1 }, { frequency: 880, delay: 0.1, duration: 0.1 }, { frequency: 1100, delay: 0.2, duration: 0.14 }],
        warning: [{ frequency: 520, delay: 0, duration: 0.13 }, { frequency: 440, delay: 0.15, duration: 0.16 }],
        error: [{ frequency: 330, delay: 0, duration: 0.15 }, { frequency: 220, delay: 0.17, duration: 0.18 }]
    };

    for (const cue of cues[kind] || cues.error) {
        const startTime = audioContext.currentTime + cue.delay;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = cue.frequency;
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.07, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + cue.duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + cue.duration);
    }
}

function triggerVisualFeedback(element) {
    element.classList.remove('visual-feedback');
    void element.offsetWidth;
    element.classList.add('visual-feedback');
}

// --- MOBILE VIEW LOGIC ---

function toggleMobileView() {
    const desktop = document.getElementById('desktop-viewport');
    const mobile = document.getElementById('mobile-viewport');

    if (mobile.classList.contains('hidden')) {
        mobile.classList.remove('hidden');
        desktop.classList.add('hidden');
    } else {
        mobile.classList.add('hidden');
        desktop.classList.remove('hidden');
    }
}

async function sendMobileFile(compress) {
    if (!compress && currentFileState.compressionStatusKind === 'processing') {
        announce('Please wait for compression to finish before sending the original.');
        return;
    }

    await primeAudioCues();
    const sentFile = await getFileToSend(compress);
    if (sentFile.tooBig) {
        showTooBigFeedback(sentFile.status);
        return;
    }

    document.getElementById('mobile-bottom-sheet').classList.add('hidden');
    const card = document.getElementById('mobile-result-card');
    card.classList.remove('hidden');
    card.innerHTML = `
        <div class="text-xs text-discord-textNormal p-3 bg-discord-sidebarBg rounded border border-discord-divider">
            <div class="font-semibold text-white">${escapeHtml(sentFile.name)} sent</div>
            <div class="mt-1 text-discord-textMuted">${escapeHtml(sentFile.status)}</div>
        </div>
    `;
    triggerVisualFeedback(card);
    triggerVisualFeedback(document.getElementById('mobile-file-progress'));
    announce(`${sentFile.name} sent. ${sentFile.status}`);
    playSoundCue(sentFile.compressed || !compress ? 'success' : 'error');
}

function toggleAttachmentMenu() {
    const menu = document.getElementById('attachment-menu');
    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen);
    document.getElementById('attachment-menu-button').setAttribute('aria-expanded', String(!isOpen));
}

function toggleMobileAttachmentMenu() {
    const menu = document.getElementById('mobile-attachment-menu');
    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen);
    document.getElementById('mobile-attachment-menu-button').setAttribute('aria-expanded', String(!isOpen));
}

function closeAttachmentMenu() {
    const menu = document.getElementById('attachment-menu');
    if (menu) menu.classList.add('hidden');
    const button = document.getElementById('attachment-menu-button');
    if (button) button.setAttribute('aria-expanded', 'false');
}

function closeMobileAttachmentMenu() {
    const menu = document.getElementById('mobile-attachment-menu');
    if (menu) menu.classList.add('hidden');
    const button = document.getElementById('mobile-attachment-menu-button');
    if (button) button.setAttribute('aria-expanded', 'false');
}

function openDrivePicker() {
    closeAttachmentMenu();
    closeMobileAttachmentMenu();
    document.getElementById('mobile-bottom-sheet').classList.add('hidden');
    const picker = document.getElementById('drive-picker');
    picker.classList.remove('hidden');
    picker.classList.add('flex');
}

async function renderDriveDemoFiles() {
    const list = document.getElementById('drive-demo-files');
    for (const file of DEMO_DRIVE_FILES) {
        if (file.type === 'audio') {
            file.dataUrl = await createDemoTone(file.frequencies);
        }

        const thumbnail = file.type === 'image'
            ? `<img src="${file.imageUrl}" alt="">`
            : `<div class="drive-demo-thumbnail"><i class="fa-solid ${file.type.startsWith('audio') ? 'fa-file-audio' : 'fa-file'}"></i></div>`;
        const note = file.note ? `<div class="text-[10px] text-discord-yellow">${escapeHtml(file.note)}</div>` : '';
        const playButton = file.type === 'audio'
            ? `<audio class="drive-demo-audio" controls preload="none" src="${file.dataUrl}"></audio>`
            : '';

        list.insertAdjacentHTML('beforeend', `
            <div class="drive-demo-item">
                ${thumbnail}
                <div class="min-w-0 flex-1">
                    <div class="truncate text-xs font-semibold text-white">${escapeHtml(file.name)}</div>
                    <div class="text-[10px] text-discord-textMuted">${file.type.startsWith('audio') ? 'Audio' : 'Image'} · ${file.size}</div>
                    ${note}
                    ${playButton}
                </div>
                <button onclick="sendDriveDemoFile(${DEMO_DRIVE_FILES.indexOf(file)})" class="shrink-0 rounded-md bg-discord-brand px-3 py-2 text-xs font-semibold text-white hover:bg-discord-brandHover">Attach</button>
            </div>
        `);
    }
}

function createDemoTone(frequencies) {
    const sampleRate = 16000;
    const noteDuration = 0.2;
    const gapDuration = 0.04;
    const samplesPerNote = Math.floor(sampleRate * noteDuration);
    const gapSamples = Math.floor(sampleRate * gapDuration);
    const sampleCount = frequencies.length * samplesPerNote + (frequencies.length - 1) * gapSamples;
    const buffer = new ArrayBuffer(44 + sampleCount * 2);
    const view = new DataView(buffer);
    const writeText = (offset, text) => [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));

    writeText(0, 'RIFF');
    view.setUint32(4, 36 + sampleCount * 2, true);
    writeText(8, 'WAVE');
    writeText(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, 'data');
    view.setUint32(40, sampleCount * 2, true);

    let sampleIndex = 0;
    frequencies.forEach(frequency => {
        for (let index = 0; index < samplesPerNote; index++, sampleIndex++) {
            const envelope = Math.min(1, index / 160, (samplesPerNote - index) / 800);
            const sample = Math.sin(2 * Math.PI * frequency * index / sampleRate) * envelope * 0.35;
            view.setInt16(44 + sampleIndex * 2, sample * 32767, true);
        }
        sampleIndex += gapSamples;
    });

    return readBlobAsDataUrl(new Blob([buffer], { type: 'audio/wav' }));
}

function sendDriveDemoFile(index) {
    const file = DEMO_DRIVE_FILES[index];
    if (!file) return;
    closeDrivePicker();

    const safeName = escapeHtml(file.name);
    let attachment;
    if (file.type === 'image') {
        attachment = `<img src="${file.imageUrl}" alt="${safeName}" class="max-h-56 max-w-xs rounded-md border border-discord-divider object-cover">`;
    } else if (file.type === 'audio') {
        attachment = `<audio class="drive-demo-audio" controls preload="none" src="${file.dataUrl}"></audio>`;
    } else {
        attachment = `<div class="drive-demo-sent-file"><i class="fa-solid fa-file-audio"></i><div><div class="font-semibold text-white">${safeName}</div><div class="text-[10px] text-discord-textMuted">${escapeHtml(file.note)}</div></div></div>`;
    }

    const attachmentMarkup = `
        <div class="space-y-2">
            ${attachment}
            <div class="text-[10px] text-discord-textMuted">Google Drive demo · ${file.size}</div>
        </div>
    `;

    if (!document.getElementById('mobile-viewport').classList.contains('hidden')) {
        const card = document.getElementById('mobile-result-card');
        card.classList.remove('hidden');
        card.innerHTML = `<div class="mb-3 rounded-md border border-discord-divider bg-discord-sidebarBg p-3"><div class="mb-2 text-xs font-semibold text-discord-brand">Shared from Google Drive</div>${attachmentMarkup}</div>`;
        return;
    }

    const message = document.createElement('div');
    message.className = 'flex space-x-4 -mx-4 px-4 py-2';
    message.innerHTML = `
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-discord-brand/20 font-semibold text-discord-brand">A</div>
        <div class="min-w-0 flex-1 space-y-2">
            <div class="flex items-baseline gap-2"><span class="text-sm font-semibold text-discord-brand">You</span><span class="text-[11px] text-discord-textMuted">Just now</span></div>
            ${attachmentMarkup}
        </div>
    `;
    document.getElementById('desktop-result-message').appendChild(message);
    const chat = document.getElementById('desktop-chat-messages');
    chat.scrollTop = chat.scrollHeight;
}

function closeDrivePicker() {
    const picker = document.getElementById('drive-picker');
    picker.classList.add('hidden');
    picker.classList.remove('flex');
}

// --- UI HELPERS ---

function selectFrame(frameNum) {
    if (frameNum === 2) goToSmartModal();
}

function setActiveNavButton(id) {
    ['btn-default-chat', 'btn-frame-1', 'btn-frame-2', 'btn-frame-6'].forEach(b => {
        const el = document.getElementById(b);
        if (el) {
            el.classList.remove('bg-discord-brand', 'text-white');
            el.classList.add('text-discord-textMuted');
        }
    });
    const active = document.getElementById(id);
    if (active) {
        active.classList.add('bg-discord-brand', 'text-white');
        active.classList.remove('text-discord-textMuted');
    }
}

// Initialize on load
window.onload = function() {
    updateUIWithCurrentFile();
    renderDriveDemoFiles();
    
    // Attach drag events to the desktop window wrapper
    const wrapper = document.getElementById('desktop-viewport');
    wrapper.addEventListener('dragover', handleDragOver);
    wrapper.addEventListener('dragleave', handleDragLeave);
    wrapper.addEventListener('drop', handleDrop);
};