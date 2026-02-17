from fpdf import FPDF

# --- CORRECT MONKEY PATCH ---
if not hasattr(FPDF, '_original_multi_cell'):
    FPDF._original_multi_cell = FPDF.multi_cell

def patched_multi_cell(self, *args, **kwargs):
    # Handle width (first arg or 'w' in kwargs)
    w = kwargs.get('w')
    if w is None and len(args) > 0:
        w = args[0]
    
    # Logic for w=0 fix
    if w == 0:
        available_width = self.w - self.r_margin - self.x
        if available_width < 5:
            self.ln()
            available_width = self.w - self.r_margin - self.x
        
        # We need to inject the collected available_width back
        # If it was positional, replace first arg. If keyword, update kwargs.
        if kwargs.get('w') is not None:
            kwargs['w'] = available_width
        elif len(args) > 0:
            args = (available_width,) + args[1:]
    
    try:
        return self._original_multi_cell(*args, **kwargs)
    except UnicodeEncodeError:
        # We need to find the text to normalize it.
        # Check 'text' (new fpdf2), 'txt' (old fpdf), or 3rd positional arg (w, h, txt)
        text = kwargs.get('text') or kwargs.get('txt')
        text_arg_index = -1
        
        if text is None:
            if len(args) >= 3:
                text = args[2]
                text_arg_index = 2
        
        if text:
            try:
                # Normalize
                normalized = text.encode('latin-1', 'replace').decode('latin-1')
                
                # Reinject
                if kwargs.get('text') is not None:
                    kwargs['text'] = normalized
                elif kwargs.get('txt') is not None:
                    kwargs['txt'] = normalized
                elif text_arg_index != -1:
                    args_list = list(args)
                    args_list[text_arg_index] = normalized
                    args = tuple(args_list)
                    
                return self._original_multi_cell(*args, **kwargs)
            except:
                pass # If replacement fails, re-raise original error
        raise
    except Exception as e:
        raise e

FPDF.multi_cell = patched_multi_cell
# --- END PATCH ---

pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

try:
    # Test positional 0 width
    pdf.multi_cell(0, 5, "Positional Text")
    print("Positional: Success")
    
    # Test keyword 0 width and text
    pdf.multi_cell(w=0, h=5, txt="Keyword Text") # Start with txt for compat
    print("Keyword (txt): Success")

    # Test mixed
    pdf.multi_cell(0, 5, txt="Mixed args")
    print("Mixed: Success")

except Exception as e:
    print(f"FAILED: {e}")
