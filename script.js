// State for dynamic user-uploaded file
let currentFileState = {
    name: "video.mp4",
    sizeBytes: 45 * 1024 * 1024,
    sizeMB: "45.0 MB",
    rawSizeMB: 45.0,
    isOverLimit: true,
    type: "video/mp4",
    dataUrl: null,
    file: null,
    iconClass: "fa-file-video"
};

let dragCounter = 0;
let currentCompressionPromise = Promise.resolve(null);

const DEMO_DRIVE_FILES = [
    { name: 'Coastline at dusk.jpg', type: 'image', size: '2.4 MB', imageUrl: 'https://picsum.photos/seed/drive-coastline/480/320' },
    { name: 'Forest trail.jpg', type: 'image', size: '1.8 MB', imageUrl: 'https://picsum.photos/seed/drive-forest/480/320' },
    { name: 'Notification chime.wav', type: 'audio', size: '180 KB', frequencies: [880, 1174, 1568] },
    { name: 'Arcade blip.wav', type: 'audio', size: '120 KB', frequencies: [440, 660, 880] },
    { name: 'Never Gonna Give You Up.mp3', type: 'audio-demo', size: '4.1 MB', note: 'Rickroll demo listing; audio not included.' }
];

// --- INITIALIZATION & UPLOAD TRIGGERS ---

function triggerDesktopUpload() {
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
    const sizeInMB = file.size / (1024 * 1024);
    const isOver = sizeInMB > 25;

    currentFileState = {
        name: file.name,
        sizeBytes: file.size,
        sizeMB: sizeInMB < 1 ? (file.size / 1024).toFixed(1) + " KB" : sizeInMB.toFixed(1) + " MB",
        rawSizeMB: sizeInMB,
        isOverLimit: isOver,
        type: file.type,
        dataUrl: null,
        compressedBlob: null,
        compressionStatus: 'Measuring compressed size...',
        file,
        iconClass: getFileIconClass(file.name, file.type)
    };

    updateUIWithCurrentFile();
    currentCompressionPromise = prepareImageCompression(file);

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
    document.getElementById('compression-note').innerText = currentFileState.type.startsWith('image/')
        ? 'Compressed size is measured on your device before sending.'
        : 'Compression is not available for this file type. It will be sent unchanged.';
    updateCompressionEstimate();

    const thumbBox = document.getElementById('modal-file-thumbnail');
    if (currentFileState.dataUrl && currentFileState.type.startsWith('image/')) {
        thumbBox.innerHTML = `<img src="${currentFileState.dataUrl}" class="w-full h-full object-cover"><div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-discord-green text-white flex items-center justify-center text-xs shadow-md font-bold"><i class="fa-solid fa-check"></i></div>`;
    } else if (currentFileState.dataUrl && currentFileState.type.startsWith('video/')) {
        thumbBox.innerHTML = `<video src="${currentFileState.dataUrl}" class="w-full h-full object-cover"></video><div class="absolute inset-0 flex items-center justify-center"><i class="fa-solid fa-play text-white/90 text-2xl drop-shadow-md"></i></div><div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-discord-green text-white flex items-center justify-center text-xs shadow-md font-bold"><i class="fa-solid fa-check"></i></div>`;
    } else {
        thumbBox.innerHTML = `<i class="fa-solid ${currentFileState.iconClass} text-discord-brand text-4xl"></i><div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-discord-green text-white flex items-center justify-center text-xs shadow-md font-bold"><i class="fa-solid fa-check"></i></div>`;
    }

    // Mobile Sync
    document.getElementById('mobile-preview-name').innerText = currentFileState.name;
    updateCompressionEstimate();
    document.getElementById('mobile-compression-note').innerText = currentFileState.type.startsWith('image/')
        ? 'Compressed size is measured on your device before sending.'
        : 'Compression is not available for this file type. It will be sent unchanged.';
    document.getElementById('mobile-preview-box').innerHTML = thumbBox.innerHTML;
}

function updateCompressionEstimate() {
    document.getElementById('modal-compressed-size').innerText = currentFileState.compressionStatus;
    document.getElementById('mobile-preview-compressed').innerText = currentFileState.compressionStatus;
}

async function prepareImageCompression(file) {
    if (!file.type.startsWith('image/')) {
        currentFileState.compressionStatus = `Unchanged size: ${currentFileState.sizeMB}`;
        updateCompressionEstimate();
        return null;
    }

    currentFileState.compressionStatus = 'Measuring compressed size...';
    updateCompressionEstimate();

    try {
        const compressedBlob = await compressImageFile(file);
        if (currentFileState.file !== file) return null;
        currentFileState.compressedBlob = compressedBlob;
        currentFileState.compressionStatus = compressedBlob
            ? `Compressed size: ${formatFileSize(compressedBlob.size)}`
            : `No size reduction; stays at ${currentFileState.sizeMB}`;
    } catch (error) {
        if (currentFileState.file !== file) return null;
        currentFileState.compressionStatus = 'Could not estimate; original stays available.';
    }

    updateCompressionEstimate();
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
    document.getElementById('frame-2-modal').classList.add('hidden');
    const sentFile = await getFileToSend(compress);
    const resultContainer = document.getElementById('desktop-result-message');
    const newMsg = document.createElement('div');
    newMsg.className = "flex space-x-4 group hover:bg-[#2E3035]/40 -mx-4 px-4 py-1.5 rounded animate-in fade-in duration-300";
    const safeName = escapeHtml(currentFileState.name);
    let previewMediaHtml = '';
    if (sentFile.dataUrl && currentFileState.type.startsWith('image/')) {
        previewMediaHtml = `<img src="${sentFile.dataUrl}" alt="${safeName}" class="max-w-xs max-h-56 rounded-lg border border-discord-divider object-cover">`;
    } else if (currentFileState.dataUrl && currentFileState.type.startsWith('video/')) {
        previewMediaHtml = `<div class="w-72 bg-black rounded-lg overflow-hidden border border-discord-divider"><video src="${currentFileState.dataUrl}" class="w-full h-36 object-cover" controls></video></div>`;
    } else {
        previewMediaHtml = `
            <div class="bg-discord-sidebarBg border border-discord-divider rounded-lg p-3 max-w-xs flex items-center space-x-3">
                <i class="fa-solid ${currentFileState.iconClass} text-discord-brand text-2xl"></i>
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
            <div class="text-[11px] text-discord-textMuted">${sentFile.status}</div>
        </div>
    `;

    resultContainer.appendChild(newMsg);
    const chatContainer = document.getElementById('desktop-chat-messages');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function getFileToSend(compress) {
    if (!compress || !currentFileState.type.startsWith('image/')) {
        return {
            dataUrl: currentFileState.dataUrl,
            sizeLabel: currentFileState.sizeMB,
            status: compress ? 'Compression is not available for this file type; sent original.' : 'Sent original without compression.'
        };
    }

    await currentCompressionPromise;
    const compressedBlob = currentFileState.compressedBlob;
    if (!compressedBlob) {
        const failed = currentFileState.compressionStatus.startsWith('Could not estimate');
        return {
            dataUrl: currentFileState.dataUrl,
            sizeLabel: currentFileState.sizeMB,
            status: failed ? 'Compression failed; sent original.' : 'No smaller version was produced; sent original.'
        };
    }

    const sizeLabel = formatFileSize(compressedBlob.size);
    return {
        dataUrl: await readBlobAsDataUrl(compressedBlob),
        sizeLabel,
        status: `Compressed from ${currentFileState.sizeMB} to ${sizeLabel} in your browser.`
    };
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
    document.getElementById('mobile-bottom-sheet').classList.add('hidden');
    const sentFile = await getFileToSend(compress);
    const card = document.getElementById('mobile-result-card');
    card.classList.remove('hidden');
    card.innerHTML = `
        <div class="text-xs text-discord-textNormal p-3 bg-discord-sidebarBg rounded border border-discord-divider">
            <div class="font-semibold text-white">${escapeHtml(currentFileState.name)} sent</div>
            <div class="mt-1 text-discord-textMuted">${sentFile.status}</div>
        </div>
    `;
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