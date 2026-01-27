from PIL import Image
import os

source_path = r"C:/Users/sinyo/.gemini/antigravity/brain/9ce23e0a-f6d8-4d29-b458-491c5e31c9f1/uploaded_media_1769518777516.png"
target_dir = r"C:/Users/sinyo/Armageddon-Core/armageddon-site/public/icons"
fallback_target = r"C:/Users/sinyo/Armageddon-Core/armageddon-site/public/icon.png"

# Ensure directory exists
os.makedirs(target_dir, exist_ok=True)

try:
    with Image.open(source_path) as img:
        # Convert to RGBA just in case
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # 192x192
        icon192 = img.resize((192, 192), Image.Resampling.LANCZOS)
        icon192.save(os.path.join(target_dir, "icon-192.png"), "PNG")
        print(f"Created icon-192.png")

        # 512x512
        icon512 = img.resize((512, 512), Image.Resampling.LANCZOS)
        icon512.save(os.path.join(target_dir, "icon-512.png"), "PNG")
        print(f"Created icon-512.png")

        # 512x512 fallback at root (often used by Next.js metadata if not defined)
        icon512.save(fallback_target, "PNG")
        print(f"Created fallback icon.png")

except Exception as e:
    print(f"Error resizing images: {e}")
    exit(1)
