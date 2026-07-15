import json
import os

filepath = r"c:\Programs\lgn\lgn-platform\design\31_nodes_export\A witness through time.json"
with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

def print_summary(node, indent=0):
    node_type = node.get("type", "UNKNOWN")
    name = node.get("name", "")
    info = f"{' ' * indent}- {name} ({node_type})"
    if "characters" in node:
        info += f': "{node["characters"][:40]}"'
    if "fills" in node:
        info += f" fills={node['fills']}"
    print(info)
    
    for child in node.get("children", []):
        print_summary(child, indent + 2)

print("Hierarchy:")
print_summary(data)
