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
        # fpdf2 output(dest='S') returns a bytearray
        val = pdf.output(dest='S')
        if isinstance(val, bytearray):
            return bytes(val)
        elif isinstance(val, str):
            return val.encode('latin-1')
        else:
            return bytes(val)
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

        const codeInput = document.getElementById('code-input');
        const fontSizeInput = document.getElementById('fontsize-input');
        const filenameInput = document.getElementById('filename-input');

        // Use 'let' so we can modify it
        let code = codeInput.value;
        const fontSize = fontSizeInput.value;
        const filename = filenameInput.value || 'python_code';

        if (!code.trim()) {
            showToast('Please enter some Python code', 'error');
            return;
        }

        startLoading();
        showToast('Generating PDF...', 'info');

        try {
            // Pre-process Code: Sanitize Unicode
            // Smart single quotes
            code = code.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
            // Smart double quotes
            code = code.replace(/\u201c/g, '"').replace(/\u201d/g, '"');
            // Dashes
            code = code.replace(/\u2013/g, '-').replace(/\u2014/g, '-');
            // Ellipsis
            code = code.replace(/\u2026/g, '...');

            // Pass data to Python
            // We use a Python script to handle execution and PDF generation robustly
            const pythonScript = `
import sys
import io
import re

# Capture stdout
sys.stdout = io.StringIO()

code_to_run = """${code.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"""
font_size_val = ${parseInt(fontSize)}

def run_code_safely(user_code, font_size):
    try:
        # Define sanitize_indentation
        def sanitize_indentation(c):
            lines = c.split('\\n')
            fixed_lines = []
            for line in lines:
                stripped = line.lstrip()
                if not stripped:
                    fixed_lines.append(line)
                    continue
                indent_len = len(line) - len(stripped)
                new_indent_len = 4 * round(indent_len / 4)
                fixed_lines.append((' ' * new_indent_len) + stripped)
            return '\\n'.join(fixed_lines)

        # Define fix_syntax
        def fix_syntax(code):
             # Basic Syntax Fixes
             # 1. Triple Quotes
             fixed = re.sub(r'"""', "'''", code)
             # 2. Missing colons
             fixed = re.sub(r'(def |class |if |else|elif |for |while |try|except|finally|with )([^:]+)(\\s*\\n)', r'\\1\\2:\\3', fixed)
             return fixed

        def fix_truncated_structures(code):
            fixed = code
            # 1. Handle "key:\n}" -> "key: [],\n}"
            fixed = re.sub(r'(:\\s*\\n\\s*)(?=[}\\]])', r': [],\\n', fixed)
            # 2. Handle "var =\n}" -> "var = []\n}"
            fixed = re.sub(r'(= \\s*\\n\\s*)(?=[}\\]])', r'= []\\n', fixed)
            # 3. Specific fix for truncated assignment
            fixed = re.sub(r'(\\w+\\s*=\\s*\\n\\s*)(?=\\},)', r'\\g<1>[{ # Auto-recovered start\\n', fixed)
            # 4. Generic fix
            fixed = re.sub(r'(\\w+\\s*=\\s*\\n\\s*)(?=[\\}\\]],?)', r'\\g<1>[] # Auto-filled\\n', fixed)
            # 5. EOF Fixes
            fixed = re.sub(r'(:\\s*)$', r': []', fixed)
            fixed = re.sub(r'(= \\s*)$', r'= []', fixed)
            return fixed
            
        # Execution Phase
        cleaned = user_code
        cleaned = cleaned.replace('\\t', '    ')
        cleaned = sanitize_indentation(cleaned)
        
        # Try running directly
        try:
            exec(cleaned, globals())
        except (SyntaxError, IndentationError):
            print("Syntax/Indentation Error. Attempting Auto-Fix...")
            fixed = fix_syntax(cleaned)
            fixed = fix_truncated_structures(fixed)
            try:
                import autopep8
                fixed = autopep8.fix_code(fixed, options={'aggressive': 2, 'ignore': ['E501', 'W292']})
            except:
                pass
            exec(fixed, globals())
            
    except Exception as e:
        return f"EXEC_ERROR: {str(e)}"

    # PDF Generation Logic Check
    # Check if a PDF file was created?
    # Or call generate_pdf if defined?
    
    if 'generate_pdf' in globals() and callable(globals()['generate_pdf']):
        try:
            globals()['generate_pdf']()
        except Exception as e:
             return f"GEN_ERROR: {str(e)}"
    elif 'generate_pdf_bytes' in globals():
         # If the user defined generate_pdf_bytes, we call it?
         # But usually user defines generate_pdf() in their script.
         val = globals()['generate_pdf_bytes'](cleaned, font_size_val)
         return val

    # Use FPDF/ReportLab check?
    # Simple fallback: Return generated bytes if any?
    # For now, let's assume the user code generates a file or outputs bytes.
    # We need to capture the file.
    
    return "SUCCESS"

result = run_code_safely(code_to_run, font_size_val)
result
`;

            const result = pyodide.runPython(pythonScript);

            if (result && result.startsWith("EXEC_ERROR")) {
                throw new Error("Execution Error: " + result.replace("EXEC_ERROR: ", ""));
            }
            if (result && result.startsWith("GEN_ERROR")) {
                throw new Error("PDF Generation Error: " + result.replace("GEN_ERROR: ", ""));
            }

            // Check for file system
            try {
                // List files
                const files = pyodide.FS.readdir('.');
                const pdfFile = files.find(f => f.endsWith('.pdf'));

                if (pdfFile) {
                    const content = pyodide.FS.readFile(pdfFile);
                    // Handle Download
                    const blob = new Blob([content], { type: 'application/pdf' });
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = pdfFile; // Use generated filename
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    showToast('PDF Downloaded!', 'success');

                    // Delete file
                    pyodide.FS.unlink(pdfFile);
                } else {
                    // Check if result was bytes?
                    if (result instanceof Uint8Array) {
                        // handled
                    } else {
                        // Check stdout
                        const stdout = pyodide.runPython("sys.stdout.getvalue()");
                        if (stdout.trim()) {
                            console.log("Python Output:", stdout);
                            showToast('Code ran (Check Console for Output)', 'info');
                        } else {
                            showToast('No PDF generated and no output', 'warning');
                        }
                    }
                }
            } catch (fsErr) {
                console.error(fsErr);
            }

        } catch (error) {
            console.error(error);
            showToast('Generation failed: ' + error.message, 'error');
        } finally {
            stopLoading();
            // Cleanup?
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