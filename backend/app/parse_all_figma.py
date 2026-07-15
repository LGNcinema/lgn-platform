import json
import os

design_dir = "/app/app/design/31_nodes_export"
output_file = "/app/app/design/figma_summary.txt"

if not os.path.exists(design_dir):
    print(f"Design dir not found: {design_dir}")
    import sys
    sys.exit(1)

files = [f for f in os.listdir(design_dir) if f.endswith('.json')]
files.sort()

out_lines = []

def parse_node(node, indent=0):
    node_type = node.get("type", "UNKNOWN")
    name = node.get("name", "")
    width = node.get("width", "")
    height = node.get("height", "")
    
    # Extract style details if present and it's a dict
    style = node.get("style", {})
    font_family = ""
    font_size = ""
    font_weight = ""
    if isinstance(style, dict):
        font_family = style.get("fontFamily", "")
        font_size = style.get("fontSize", "")
        font_weight = style.get("fontWeight", "")

    fills = node.get("fills", [])
    fill_hex = ""
    if isinstance(fills, list):
        for f in fills:
            if isinstance(f, dict) and f.get("type") == "SOLID" and "color" in f:
                c = f["color"]
                hex_val = f.get("hex", "")
                if not hex_val and isinstance(c, dict):
                    r = int(c.get("r", 0) * 255)
                    g = int(c.get("g", 0) * 255)
                    b = int(c.get("b", 0) * 255)
                    hex_val = f"#{r:02x}{g:02x}{b:02x}"
                fill_hex = hex_val
                break

    node_str = f"{' ' * indent}- {name} ({node_type})"
    attrs = []
    if width and height:
        attrs.append(f"{width}x{height}")
    if fill_hex:
        attrs.append(f"fill={fill_hex}")
    if font_family:
        attrs.append(f"font='{font_family}' {font_size}px(w={font_weight})")
    
    if attrs:
        node_str += f" [{', '.join(attrs)}]"
        
    if "characters" in node:
        chars = str(node["characters"]).replace('\n', '\\n')
        if len(chars) > 100:
            chars = chars[:97] + "..."
        node_str += f': "{chars}"'
        
    out_lines.append(node_str)
    
    # child traversal
    children = node.get("children", [])
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                parse_node(child, indent + 2)

for filename in files:
    filepath = os.path.join(design_dir, filename)
    out_lines.append("="*60)
    out_lines.append(f"FILE: {filename}")
    out_lines.append("="*60)
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        parse_node(data)
    except Exception as e:
        out_lines.append(f"Error parsing file: {e}")
    out_lines.append("")

with open(output_file, 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines))

print(f"Summary written to {output_file}")
