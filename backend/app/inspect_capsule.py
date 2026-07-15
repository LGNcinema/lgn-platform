import json

for filepath in [
    "/app/app/design/31_nodes_export/[CAPSULE].json",
    "/app/app/design/31_nodes_export/[CAPSULE]—Reflect.json"
]:
    print("="*60)
    print(filepath)
    print("="*60)
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    def find_texts(node, path=""):
        name = node.get("name", "")
        node_type = node.get("type", "")
        current_path = f"{path}/{name}" if path else name
        
        if node_type == "TEXT":
            print(f"PATH: {current_path}")
            print(f"CHARS: {node.get('characters', '')}")
            print(f"SIZE: {node.get('width', '')}x{node.get('height', '')}")
            print("-" * 30)
            
        children = node.get("children", [])
        if isinstance(children, list):
            for child in children:
                if isinstance(child, dict):
                    find_texts(child, current_path)
                    
    find_texts(data)
