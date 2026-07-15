import json

filepath = "/app/app/design/31_nodes_export/Header.json"
with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

def print_nodes(node, indent=0):
    node_type = node.get("type", "UNKNOWN")
    name = node.get("name", "")
    w = node.get("width", 0)
    h = node.get("height", 0)
    
    info = f"{' ' * indent}- {name} ({node_type}) size={w}x{h}"
    if "characters" in node:
        info += f' chars="{node["characters"]}"'
    print(info)
    
    children = node.get("children", [])
    if isinstance(children, list):
        for child in children:
            if isinstance(child, dict):
                print_nodes(child, indent + 2)

print_nodes(data)
