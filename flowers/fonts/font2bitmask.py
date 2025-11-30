import json
import os
import sys
from PIL import Image

def parse_bmfont_txt(txt_path):
    chars = {}
    with open(txt_path, 'r') as f:
        for line in f:
            if line.startswith('char id='):
                parts = line.split()
                char_data = {}
                for part in parts:
                    if '=' in part:
                        key, val = part.split('=')
                        char_data[key] = int(val)
                chars[char_data['id']] = char_data
    return chars

def get_pixel_value(img, x, y):
    # Check bounds
    if x < 0 or x >= img.width or y < 0 or y >= img.height:
        return 0
    p = img.getpixel((x, y))
    # Assuming black text on transparent or white, or white text.
    # Let's inspect the values. Usually alpha channel is key for transparent PNGs.
    # Or if it's RGB, checking for non-black or non-white.
    
    # If image mode is RGBA, check Alpha.
    if img.mode == 'RGBA':
        if p[3] > 128: return 1
        return 0
    elif img.mode == 'P':
        # Palette mode, check index
        # Often index 0 is transparent.
        # But let's assume if it's a bitmap font, maybe color doesn't matter, just presence.
        return 1 if p != 0 else 0 # Naive check
    else:
        # Grayscale or RGB
        # Assuming higher value is 'on' or lower value is 'on'?
        # Let's assume standard BMFont: white text on transparent.
        # Check average intensity
        if isinstance(p, tuple):
            intensity = sum(p) / len(p)
            return 1 if intensity > 128 else 0
        else:
            return 1 if p > 128 else 0

def convert_to_bitmask(chars, img_path):
    img = Image.open(img_path)
    img = img.convert('RGBA') # Convert to RGBA for consistent handling
    
    mapping = {}
    
    # We want a 5x5 grid.
    # Based on analysis, yoffset seems to start at 1 for top-aligned chars.
    # We will subtract 1 from yoffset.
    Y_SHIFT = -1
    
    for char_id, data in chars.items():
        if char_id < 32: continue # Skip control chars if any
        
        # Determine the character
        try:
            char_str = chr(char_id)
        except:
            continue
            
        # Extract rect
        x, y, w, h = data['x'], data['y'], data['width'], data['height']
        xoff, yoff = data['xoffset'], data['yoffset']
        
        # Create 5x5 grid
        # We will represent it as an integer where bit 0 is (0,0), bit 1 is (1,0)... 
        # Actually, let's define the bit order:
        # Let's go row by row.
        # (0,0) is MSB or LSB? 
        # Usually for font rendering, one might prefer:
        # Row 0: bits 0-4
        # Row 1: bits 5-9
        # ...
        # LSB at (0,0) means value = sum(pixel * 2^(y*5 + x))
        
        mask = 0
        
        # Crop from image
        # Note: crop is lazy in Pillow sometimes, but accessing pixels is fine.
        
        # We need to map the source pixels to the 5x5 target grid.
        # Target grid coordinates: tx, ty in [0, 4]
        # Source pixel (sx, sy) relative to crop top-left:
        # A pixel at target (tx, ty) corresponds to source pixel ONLY if
        # tx corresponds to xoff + sx?
        # 
        # Placement logic:
        # The glyph starts at target_x = xoff, target_y = yoff + Y_SHIFT
        # It has width w and height h.
        # So for sy in 0..h-1:
        #   for sx in 0..w-1:
        #     target_x = xoff + sx
        #     target_y = yoff + Y_SHIFT + sy
        #     pixel value at image(x+sx, y+sy) -> mask at (target_x, target_y)
        
        start_tx = xoff
        start_ty = yoff + Y_SHIFT
        
        # Crop is at x, y in image
        
        for sy in range(h):
            for sx in range(w):
                tx = start_tx + sx
                ty = start_ty + sy
                
                # Check if inside 5x5
                if 0 <= tx < 5 and 0 <= ty < 5:
                    # Check pixel in image
                    px = x + sx
                    py = y + sy
                    
                    val = img.getpixel((px, py))
                    # Check alpha or brightness
                    is_set = False
                    
                    # Robust check:
                    # If alpha channel exists and is low, it's transparent (off).
                    # If alpha is high, check color.
                    # If image is just black text on white, brightness is low -> set.
                    # If image is white text on transparent, brightness is high -> set.
                    
                    alpha = 255
                    if len(val) == 4:
                        alpha = val[3]
                    
                    if alpha < 50:
                        is_set = False
                    else:
                        # Check intensity
                        intensity = sum(val[:3]) / 3
                        # Heuristic: Determine if the font is light-on-dark or dark-on-light?
                        # Since we process char-by-char, we can't easily guess global.
                        # But typically BMFonts are white-on-transparent.
                        # However, the user thumbnail looked black.
                        # Let's assume if it's NOT transparent, and it's BLACK (low intensity), it is ink.
                        # OR if it is WHITE (high intensity) on TRANSPARENT, it is ink.
                        
                        # Let's check for "not background".
                        # Assuming background is either transparent or white.
                        if intensity < 100: is_set = True # Dark pixel = ink
                        elif intensity > 200 and alpha > 200: 
                             # White pixel. Is it ink or background?
                             # In standard white-on-transparent, this is ink.
                             # If it was black-on-white, this would be background.
                             # But we handled dark pixel above.
                             # So if we have white pixels, they are likely ink IF background is transparent.
                             is_set = True 
                        else:
                             # Gray area.
                             is_set = True if alpha > 128 else False

                    if is_set:
                        # Set bit
                        # User reported 180 rotation (flipped both x and y)
                        # So we map (tx, ty) -> (4-tx, 4-ty)
                        # Original: index = ty * 5 + tx
                        
                        # We want the output integer to represent the flipped version? 
                        # Or the user says "it is currently rotated", so I need to UN-rotate it?
                        # If the user says "the letters seem to be 180 rotated", they imply the current result is WRONG.
                        # My visualization showed them UPRIGHT.
                        # This means the user's renderer interprets the bits differently than my visualizer.
                        # If my visualizer (LSB=TopLeft) shows Upright, and User's renderer shows Rotated 180,
                        # Then User's renderer likely maps LSB=BottomRight (or equivalent).
                        # To fix it for the user, I should generate the bitmask such that when THEY render it, it looks upright.
                        # So I need to pre-rotate it 180 degrees relative to my current logic?
                        # If they see it rotated 180, I need to rotate it 180 (which is the inverse of 180) to cancel it out?
                        
                        # If they see:
                        # ..#..
                        # .....
                        # (inverted T)
                        # Instead of T.
                        
                        # I should generate an inverted T in MY logic, so that their logic flips it back to T?
                        # OR, if they see it rotated, maybe I just flip the coordinates.
                        
                        # Let's try flipping coordinates.
                        
                        r_tx = 4 - tx
                        r_ty = 4 - ty
                        
                        index = r_ty * 5 + r_tx
                        mask |= (1 << index)
        
        mapping[char_str] = mask
        
    return mapping

def visualize(mapping, char_str):
    if char_str not in mapping: return
    sys.stderr.write(f"Visualizing '{char_str}':\n")
    mask = mapping[char_str]
    for y in range(5):
        line = ""
        for x in range(5):
            if mask & (1 << (y * 5 + x)):
                line += "#"
            else:
                line += "."
        sys.stderr.write(line + "\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python font2bitmask.py <fontname>")
        sys.exit(1)
        
    font_name = sys.argv[1]
    base_dir = os.path.dirname(os.path.abspath(__file__))
    txt_path = os.path.join(base_dir, f"{font_name}/{font_name}.txt")
    png_path = os.path.join(base_dir, f"{font_name}/{font_name}.png")
    
    if not os.path.exists(txt_path):
        # Try finding it in current dir if not found in subdir
        txt_path = os.path.join(base_dir, f"{font_name}.txt")
        png_path = os.path.join(base_dir, f"{font_name}.png")

    if not os.path.exists(txt_path):
        print(f"Error: Could not find {txt_path}")
        sys.exit(1)
        
    chars = parse_bmfont_txt(txt_path)
    mapping = convert_to_bitmask(chars, png_path)
    
    # Dump to JSON
    print(json.dumps(mapping, ensure_ascii=False, indent=2))
    
    # Debug visualization (commented out)
    # visualize(mapping, 'A')
    # visualize(mapping, '!')
    # visualize(mapping, '.')
    # visualize(mapping, '#')
