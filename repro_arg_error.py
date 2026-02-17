from fpdf import FPDF

# --- RECRATING THE BUGGY PATCH ---
if not hasattr(FPDF, '_original_multi_cell'):
    FPDF._original_multi_cell = FPDF.multi_cell

def patched_multi_cell(self, w, h=None, text_content='', *args, **kwargs):
    # This likely fails if called as multi_cell(0, 5, "text") because "text" is assigned to text_content
    # AND then passed again or if fpdf expects 'txt' but we use 'text_content'.
    # FPDF2 signature: multi_cell(self, w, h=None, txt="", border=0, align="J", fill=False)
    # If I rename 'txt' to 'text_content', then 'txt' might be in **kwargs?
    
    # Let's try to just forward standard args.
    return self._original_multi_cell(w, h, text_content, *args, **kwargs)

FPDF.multi_cell = patched_multi_cell
# --- END PATCH ---

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

try:
    # Typical call: positional args
    pdf.multi_cell(0, 5, "Positional Text")
    print("Positional: Success")
    
    # Keyword arg call
    pdf.multi_cell(0, 5, txt="Keyword Text")
    print("Keyword: Success")
except Exception as e:
    print(f"FAILED: {e}")
