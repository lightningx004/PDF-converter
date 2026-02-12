import streamlit as st
from fpdf import FPDF
import autopep8
import tempfile
import os
import subprocess
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
import io

# --- Page Config ---
st.set_page_config(
    page_title="Python Code to PDF & Fixer",
    layout="wide",
    initial_sidebar_state="expanded"
)

# --- Session State Initialization ---
if 'code_input' not in st.session_state:
    st.session_state.code_input = ""

# --- Helper Functions ---

def run_linter(code):
    """Runs flake8 on the provided code and returns a list of errors/warnings."""
    if not code.strip():
        return ["No code to check."]

    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as tmp:
        tmp.write(code)
        tmp_path = tmp.name

    try:
        # Run flake8
        result = subprocess.run(
            [sys.executable, "-m", "flake8", tmp_path],
            capture_output=True,
            text=True
        )
        output = result.stdout
        
        # Clean up filename from output to make it cleaner
        cleaned_output = []
        for line in output.splitlines():
            # flake8 output format: file:line:col: code message
            # We want to remove the file path
            parts = line.split(':', 3)
            if len(parts) >= 4:
                line_num = parts[1]
                col_num = parts[2]
                message = parts[3]
                cleaned_output.append(f"Line {line_num}, Col {col_num}: {message.strip()}")
            else:
                cleaned_output.append(line)
        
        return cleaned_output if cleaned_output else ["No errors found! Great job."]

    except Exception as e:
        return [f"Error running linter: {str(e)}"]
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def auto_fix_code(code):
    """Uses autopep8 to fix the code."""
    try:
        # aggressive=1 is usually safe for formatting
        fixed_code = autopep8.fix_code(code, options={'aggressive': 1})
        return fixed_code
    except Exception as e:
        st.error(f"Auto-fix failed: {e}")
        return code

class CodePDF(FPDF):
    def header(self):
        self.set_font('Courier', 'B', 12)
        self.cell(0, 10, 'Python Code Document', 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Courier', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def generate_pdf(code):
    """Generates a PDF with line numbers and Courier font."""
    pdf = CodePDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Courier", size=10)
    
    lines = code.split('\n')
    line_height = 5
    
    for i, line in enumerate(lines, 1):
        # Format: "  1: import os"
        line_content = f"{i:>4}: {line}"
        # Use text= instead of txt= (fpdf2)
        try:
            # Explicitly set new_x and new_y to ensure carriage return to left margin
            pdf.multi_cell(0, line_height, text=line_content, new_x="LMARGIN", new_y="NEXT")
        except Exception as e:
            st.error(f"Error generating PDF at line {i}: {e}")
            raise e
        
    # fpdf2 output(dest='S') returns bytearray, so no need to encode.
    # We convert to bytes just to be safe.
    return bytes(pdf.output(dest='S'))

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT
import io

# ... (other imports)

def generate_pdf_reportlab(code):
    """Generates a PDF using ReportLab with line numbers and Courier font via Platypus for wrapping."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                            rightMargin=40, leftMargin=40,
                            topMargin=40, bottomMargin=40)
    
    styles = getSampleStyleSheet()
    # Create a custom style for code
    code_style = ParagraphStyle(
        name='CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=10,
        leading=12,  # Line spacing
        alignment=TA_LEFT,
        wordWrap='CJK', # Allow breaking lines within words if needed, though 'LTR' is default
    )

    story = []
    lines = code.split('\n')
    
    for i, line in enumerate(lines, 1):
        # Escape HTML characters for Paragraph: <, >, &
        safe_line = line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        # Repace spaces with non-breaking spaces to preserve indentation?
        # Paragraph collapses multiple spaces. We want to preserve them for code indentation.
        # Replacing space with &nbsp;
        safe_line = safe_line.replace(' ', '&nbsp;')
        
        line_content = f"{i:>4}:&nbsp;{safe_line}"
        p = Paragraph(line_content, code_style)
        story.append(p)
        # story.append(Spacer(1, 1)) # Optional small spacer, but leading handles line height
        
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()

# --- Sidebar (The Debugger) ---
with st.sidebar:
    st.header("⚙️ Settings")
    pdf_engine = st.radio("PDF Engine", ["FPDF2", "ReportLab"], index=0)
    
    st.divider()

    st.header("🛠️ Debugger & Fixer")
    
    # Use columns to keep buttons side-by-side and always visible at the top
    col_debug_1, col_debug_2 = st.columns(2)
    
    with col_debug_1:
        check_btn = st.button("Check Errors")
        
    with col_debug_2:
        fix_btn = st.button("Apply Fixes")

    # Container for error messages so they appear below the buttons
    results_container = st.container()

    if check_btn:
        errors = run_linter(st.session_state.code_input)
        with results_container:
            if errors and errors[0].startswith("No errors"):
                st.success(errors[0])
            else:
                st.warning(f"Found {len(errors)} issues:")
                for err in errors:
                    st.error(err)

    if fix_btn:
        if st.session_state.code_input:
            fixed = auto_fix_code(st.session_state.code_input)
            if fixed != st.session_state.code_input:
                st.session_state.code_input = fixed
                st.rerun()
            else:
                results_container.info("Code is already PEP8 compliant.")
        else:
            results_container.warning("No code to fix.")

# --- Main Area (The Editor) ---
st.title("🐍 Python Code to PDF Converter")

# Code Editor
# We use key='code_input' to bind it to session state automatically, 
# but we also need to manually handle updates if we modify it programmatically.
code = st.text_area(
    "Paste your Python code here:",
    height=400,
    key="code_input" 
)

col1, col2 = st.columns([1, 1])

with col1:
    if st.button("Clear Code"):
        st.session_state.code_input = ""
        st.rerun()

with col2:
    if code:
        try:
            if pdf_engine == "ReportLab":
                pdf_bytes = generate_pdf_reportlab(code)
            else:
                pdf_bytes = generate_pdf(code)
            
            st.download_button(
                label="📄 Generate PDF",
                data=pdf_bytes,
                file_name="code_document.pdf",
                mime="application/pdf"
            )
        except Exception as e:
            st.error(f"Error generating PDF: {e}")
