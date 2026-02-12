document.addEventListener('DOMContentLoaded', () => {
    const codeInput = document.getElementById('code-input');
    const convertBtn = document.getElementById('convert-btn');
    const resetBtn = document.getElementById('reset-btn');
    const filenameInput = document.getElementById('filename-input');
    const fontSizeInput = document.getElementById('fontsize-input');
    const lineNumbers = document.getElementById('line-numbers');
    
    // Stats elements
    const statLines = document.getElementById('stat-lines');
    const statChars = document.getElementById('stat-chars');
    const statWords = document.getElementById('stat-words');

    // --- 1. Editor UI Logic ---

    // Update line numbers and stats on input
    codeInput.addEventListener('input', () => {
        updateStats();
        updateLineNumbers();
    });

    // Sync scroll
    codeInput.addEventListener('scroll', () => {
        lineNumbers.scrollTop = codeInput.scrollTop;
    });

    // Handle Tab key
    codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeInput.selectionStart;
            const end = codeInput.selectionEnd;
            codeInput.value = codeInput.value.substring(0, start) + '    ' + codeInput.value.substring(end);
            codeInput.selectionStart = codeInput.selectionEnd = start + 4;
            updateStats();
        }
    });

    // Reset Button
    resetBtn.addEventListener('click', () => {
        codeInput.value = '';
        updateStats();
        updateLineNumbers();
        showToast('Editor cleared', 'info');
    });

    // --- 2. Conversion Logic (Server Side) ---

    convertBtn.addEventListener('click', async () => {
        const code = codeInput.value;
        const fontSize = fontSizeInput.value;
        const filename = filenameInput.value || 'python_code';

        if (!code.trim()) {
            showToast('Please enter some Python code', 'error');
            return;
        }

        startLoading();
        showToast('Converting...', 'info');

        try {
            // Send to Flask Server
            const response = await fetch('/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    font_size: fontSize,
                    filename: filename
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Conversion failed');
            }

            // Handle File Download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            showToast('PDF Generated Successfully!', 'success');

        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
        } finally {
            stopLoading();
        }
    });

    // --- Helper Functions ---

    function updateStats() {
        const text = codeInput.value;
        statLines.textContent = text ? text.split('\n').length : 0;
        statChars.textContent = text.length;
        statWords.textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
    }

    function updateLineNumbers() {
        const lines = codeInput.value.split('\n').length;
        lineNumbers.innerHTML = Array(lines).fill(1).map((_, i) => `<div>${i + 1}</div>`).join('');
    }

    function startLoading() {
        convertBtn.classList.add('loading');
        convertBtn.disabled = true;
    }

    function stopLoading() {
        convertBtn.classList.remove('loading');
        convertBtn.disabled = false;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Initialize
    updateStats();
    updateLineNumbers();
});