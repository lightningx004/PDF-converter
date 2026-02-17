import re

def clean_code(code, font_size=None):
    # Remove markdown code fences
    code = re.sub(r'```python|```', '', code)
    
    # Remove citation markers like [cite_start], [cite: 1], etc.
    code = re.sub(r'\[cite_start\]', '', code)
    code = re.sub(r'\[cite: \d+\]', '', code)
    code = re.sub(r'\[cite_end\]', '', code)
    
    # Inject Font Size if provided
    if font_size:
        print(f"Applying font size: {font_size}")
        
        # FPDF: set_font_size(12) -> set_font_size(16)
        code = re.sub(r'(\.set_font_size\s*\()\s*\d+', f'\\g<1>{font_size}', code)
        print("After set_font_size:", code)
        
        # FPDF: set_font(..., size=12) -> set_font(..., size=16) (Keyword arg)
        code = re.sub(r'(\.set_font\s*\([^)]*?size\s*=\s*)\d+', f'\\g<1>{font_size}', code)
        print("After set_font kwarg:", code)
        
        # FPDF: set_font("Arial", 12) or set_font("Arial", "B", 12) (Positional)
        # Match: .set_font(..., <digits>) where ... does not contain "=" (to avoid keyword collisions)
        # Using a more robust pattern
        code = re.sub(r'(\.set_font\s*\((?:[^()=]+,)\s*)\d+(\s*\))', f'\\g<1>{font_size}\\g<2>', code)
        print("After set_font positional:", code)
        
        # ReportLab: setFont("Name", 12) -> setFont("Name", 16)
        code = re.sub(r'(\.setFont\s*\([^,]+,\s*)\d+', f'\\g<1>{font_size}', code)
        print("After setFont:", code)
    
    return code.strip()

# Test Case 1: Standard FPDF
code1 = """
class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.cell(80)

pdf = PDF()
pdf.add_page()
pdf.set_font('Times', '', 12)
pdf.output('tuto2.pdf')
"""

# Test Case 2: Keyword Arg
code2 = """
pdf.set_font("Arial", size=12)
"""

# Test Case 3: set_font_size
code3 = """
pdf.set_font_size(12)
"""

# Test Case 4: ReportLab
code4 = """
c.setFont("Helvetica", 12)
"""

print("--- TEST 1 ---")
cleaned1 = clean_code(code1, 24)
print("\nFINAL 1:\n", cleaned1)

print("\n--- TEST 2 ---")
cleaned2 = clean_code(code2, 24)
print("\nFINAL 2:\n", cleaned2)

print("\n--- TEST 3 ---")
cleaned3 = clean_code(code3, 24)
print("\nFINAL 3:\n", cleaned3)

print("\n--- TEST 4 ---")
cleaned4 = clean_code(code4, 24)
print("\nFINAL 4:\n", cleaned4)
