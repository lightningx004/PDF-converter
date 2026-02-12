document.addEventListener('DOMContentLoaded', async () => {
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

    let pyodide = null;
    let pyodideReady = false;

    // --- Initialization ---
    async function initPyodide() {
        try {
            convertBtn.disabled = true;
            convertBtn.innerHTML = '<span class="btn-loader"></span> Loading Python...';

            pyodide = await loadPyodide();
            await pyodide.loadPackage("micropip");
            const micropip = pyodide.pyimport("micropip");
            await micropip.install("fpdf2");

            // Define Python logic
            pyodide.runPython(`
from fpdf import FPDF
import io

class CodePDF(FPDF):
    def header(self):
        self.set_font('Courier', 'B', 12)
        self.cell(0, 10, 'Python Code Document', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Courier', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def generate_pdf_bytes(code, font_size):
    try:
        pdf = CodePDF()
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()
        pdf.set_font("Courier", size=int(font_size))
        
        lines = code.split('\\n')
        line_height = 5
        
        for i, line in enumerate(lines, 1):
            line_content = f"{i:>4}: {line}"
            # fpdf2 compatible call
            pdf.multi_cell(0, line_height, text=line_content, new_x="LMARGIN", new_y="NEXT", align='L')
            
        # Output as bytes
        return pdf.output(dest='S').encode('latin-1')
    except Exception as e:
        return str(e)
            `);

            pyodideReady = true;
            convertBtn.disabled = false;
            convertBtn.innerHTML = '<i class="fa-solid fa-download"></i> <span class="btn-text">Convert to PDF</span> <span class="btn-loader"></span>';
            showToast('Ready for offline use!', 'success');
        } catch (err) {
            console.error("Pyodide failed to load", err);
            showToast('Failed to load Python environment', 'error');
            convertBtn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Error Loading';
        }
    }

    // Start loading immediately
    initPyodide();

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

    // --- 2. Conversion Logic (Client Side) ---

    convertBtn.addEventListener('click', async () => {
        if (!pyodideReady) {
            showToast('Python is still loading, please wait...', 'info');
            return;
        }

        const code = codeInput.value;
        const fontSize = fontSizeInput.value;
        const filename = filenameInput.value || 'python_code';

        if (!code.trim()) {
            showToast('Please enter some Python code', 'error');
            return;
        }

        startLoading();
        showToast('Generating PDF...', 'info');

        try {
            // Pass data to Python
            pyodide.globals.set("user_code", code);
            pyodide.globals.set("user_font_size", parseInt(fontSize));

            // Run generation
            const pdfBytesProxy = pyodide.runPython("generate_pdf_bytes(user_code, user_font_size)");

            if (typeof pdfBytesProxy === 'string') {
                // If it returns a string, it might be an error message from our catch block
                // Note: pdf.output().encode() returns bytes, but if exception caught we returned str(e)
                // Let's check type
                throw new Error("PDF generation error: " + pdfBytesProxy);
            }

            // Convert JsProxy (bytes) to JS Unit8Array
            const pdfBytes = pdfBytesProxy.toJs();
            pdfBytesProxy.destroy();

            // Handle File Download
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();

            showToast('PDF Downloaded!', 'success');

        } catch (error) {
            console.error(error);
            showToast('Generation failed: ' + error.message, 'error');
        } finally {
            stopLoading();
            // Cleanup
            pyodide.globals.delete("user_code");
            pyodide.globals.delete("user_font_size");
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

    // Initialize UI
    updateStats();
    updateLineNumbers();
});