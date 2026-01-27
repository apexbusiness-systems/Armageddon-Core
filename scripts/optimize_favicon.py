from PIL import Image
import os

source_path = r"C:/Users/sinyo/.gemini/antigravity/brain/9ce23e0a-f6d8-4d29-b458-491c5e31c9f1/uploaded_media_1769518777516.png"
target_dir = r"C:/Users/sinyo/Armageddon-Core/armageddon-site/public"
target_ico = os.path.join(target_dir, "favicon.ico")

try:
    with Image.open(source_path) as img:
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # Prepare sizes for ICO
        sizes = [
            (16, 16),
            (32, 32),
            (48, 48),  # Standard Windows icon size
            (64, 64),  # High DPI
        ]

        icon_layers = []
        for size in sizes:
            resized = img.resize(size, Image.Resampling.LANCZOS)
            icon_layers.append(resized)

        # Save as multi-size ICO
        icon_layers[0].save(
            target_ico,
            format="ICO",
            sizes=[l.size for l in icon_layers],
            append_images=icon_layers[1:],
        )
        print(f"Created optimized favicon.ico with sizes: {sizes}")

except Exception as e:
    print(f"Error creating favicon: {e}")
    exit(1)
