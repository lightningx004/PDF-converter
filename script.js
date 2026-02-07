document.addEventListener('DOMContentLoaded', async () => {
    const codeInput = document.getElementById('code-input');
    const convertBtn = document.getElementById('convert-btn');
    const resetBtn = document.getElementById('reset-btn');
    const filenameInput = document.getElementById('filename-input');
    const fontSizeInput = document.getElementById('fontsize-input');
    const lineNumbers = document.getElementById('line-numbers');
    const statLines = document.getElementById('stat-lines');
    const statChars = document.getElementById('stat-chars');
    const statWords = document.getElementById('stat-words');

    let pyodide = null;
    let pyodideReady = false;

    // Initial Stats
    updateStats();

    // Load Pyodide
    async function initPyodide() {
        showToast('Initializing Pyodide...', 'info');
        try {
            if (typeof loadPyodide === 'undefined') {
                throw new Error('Pyodide script not loaded. Check your internet connection.');
            }

            pyodide = await loadPyodide();

            showToast('Loading Micropip...', 'info');
            await pyodide.loadPackage("micropip");
            const micropip = pyodide.pyimport("micropip");

            showToast('Installing fpdf2 library...', 'info');
            await micropip.install("fpdf2");

            showToast('Configuring environment...', 'info');
            // Define clean_code function in Python environment
            await pyodide.runPythonAsync(`
import re

def clean_code(code, font_size=None):
    # Remove markdown code fences
    code = re.sub(r'\`\`\`python|\`\`\`', '', code)
    
    # Remove citation markers
    code = re.sub(r'\\[cite_start\\]', '', code)
    code = re.sub(r'\\[cite: \\d+\\]', '', code)
    code = re.sub(r'\\[cite_end\\]', '', code)
    
    # Inject Font Size if provided
    if font_size:
        # FPDF: set_font_size(12) -> set_font_size(16)
        code = re.sub(r'(\\.set_font_size\\s*\\()\\s*\\d+', f'\\\\g<1>{font_size}', code)
        
        # FPDF: set_font(..., size=12) -> set_font(..., size=16) (Keyword arg)
        code = re.sub(r'(\\.set_font\\s*\\([^)]*?size\\s*=\\s*)\\d+', f'\\\\g<1>{font_size}', code)
        
        # FPDF: set_font("Arial", 12) (Positional)
        code = re.sub(r'(\\.set_font\\s*\\((?:[^()=]+,)\\s*)\\d+(\\s*\\))', f'\\\\g<1>{font_size}\\\\g<2>', code)
        
        # ReportLab: setFont("Name", 12) -> setFont("Name", 16)
        code = re.sub(r'(\\.setFont\\s*\\([^,]+,\\s*)\\d+', f'\\\\g<1>{font_size}', code)
    
    return code.strip()
            `);

            pyodideReady = true;
            showToast('Python ready!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to load Python environment', 'error');
        }
    }

    initPyodide();

    // Editor Interactions
    codeInput.addEventListener('input', () => {
        updateStats();
        updateLineNumbers();
    });

    codeInput.addEventListener('scroll', () => {
        lineNumbers.scrollTop = codeInput.scrollTop;
    });

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

    // Convert Button
    convertBtn.addEventListener('click', async () => {
        if (!pyodideReady) {
            showToast('Python is still loading...', 'info');
            return;
        }

        const code = codeInput.value;
        const fontSize = fontSizeInput.value;
        if (!code.trim()) {
            showToast('Please enter some Python code', 'error');
            return;
        }

        startLoading();

        try {
            // cleanup previous pdfs
            await pyodide.runPythonAsync(`
import os
import glob
for f in glob.glob("*.pdf"):
    try:
        os.remove(f)
    except:
        pass
            `);

            // Set variables for Python
            pyodide.globals.set("user_code", code);
            pyodide.globals.set("font_size", fontSize);

            // Execute Conversion
            await pyodide.runPythonAsync(`
import glob
import sys
from fpdf import FPDF
import fpdf

# --- MONKEY PATCH START ---
# Save original method
if not hasattr(FPDF, '_original_multi_cell'):
    FPDF._original_multi_cell = FPDF.multi_cell

def patched_multi_cell(self, w, *args, **kwargs):
    # If w is 0, use effective page width (epw)
    if w == 0:
        w = self.epw
    return self._original_multi_cell(w, *args, **kwargs)

FPDF.multi_cell = patched_multi_cell
# --- MONKEY PATCH END ---

cleaned = clean_code(user_code, font_size)

try:
    # Attempt to execute valid Python code
    exec(cleaned)
    
    # Check if a PDF was actually generated
    pdfs = glob.glob("*.pdf")
    if not pdfs:
        raise Exception("No PDF generated")

except Exception as e:
    print(f"Execution failed ({e}), falling back to text conversion...")
    
    # Fallback: Create PDF from text content
    pdf = FPDF()
    pdf.add_page()
    
    # Use Courier for code look
    try:
        pdf.set_font("Courier", size=int(font_size))
    except:
        pdf.set_font("Courier", size=12)
        
    # Multi_cell handles newlines automatically
    # Effective page width = 210 - 2*10 (margins) = 190
    pdf.multi_cell(0, 5, txt=user_code)
    
    pdf.output("output.pdf")
            `);

            // Check for PDF
            const pdfFiles = await pyodide.runPythonAsync(`
import glob
glob.glob("*.pdf")
            `);

            const filesList = pdfFiles.toJs();

            if (filesList.length === 0) {
                throw new Error("No PDF file generated. Ensure your code saves a PDF (e.g. pdf.output('name.pdf'))");
            }

            const pdfFilename = filesList[0];

            // Read file bytes
            const pdfBytes = pyodide.FS.readFile(pdfFilename);

            // Create Blob and Download
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filenameInput.value ? (filenameInput.value.endsWith('.pdf') ? filenameInput.value : filenameInput.value + '.pdf') : pdfFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();

            showToast('PDF Generated Successfully!', 'success');

        } catch (error) {
            console.error('Error:', error);
            // Pyodide errors can be verbose, try to get the message
            let msg = error.message;
            if (msg.includes("PythonClientError")) {
                msg = "Python Execution Failed";
            }
            showToast(msg, 'error');
        } finally {
            stopLoading();
        }
    });

    // Helper Functions
    function updateStats() {
        const text = codeInput.value;
        const lines = text ? text.split('\n').length : 0;
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;

        statLines.textContent = lines;
        statChars.textContent = chars;
        statWords.textContent = words;
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
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';

        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

        const container = document.getElementById('toast-container');
        container.appendChild(toast);

        // Remove after animation
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
});
