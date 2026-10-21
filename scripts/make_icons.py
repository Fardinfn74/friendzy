import os
import base64
from PIL import Image

def main():
    # 1. Load the transparent sticker
    sticker = Image.open('public/stickers/friendzy-sticker.png')
    bbox = sticker.getbbox()
    cropped = sticker.crop(bbox)

    # Target square canvas with gentle padding (6% on each side)
    side = int(max(cropped.width, cropped.height) * 1.08)
    square_sticker = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    ox = (side - cropped.width) // 2
    oy = (side - cropped.height) // 2
    square_sticker.paste(cropped, (ox, oy), cropped)

    # Save master 1024x1024 transparent icon
    master_1024 = square_sticker.resize((1024, 1024), Image.Resampling.LANCZOS)
    master_1024.save('public/stickers/friendzy-icon.png', optimize=True)

    # Save 512x512 icon
    icon_512 = square_sticker.resize((512, 512), Image.Resampling.LANCZOS)
    icon_512.save('public/icon-512.png', optimize=True)

    # Save 192x192 icon for PWA
    icon_192 = square_sticker.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save('public/icon-192.png', optimize=True)

    # Save 64x64 favicon
    favicon_64 = square_sticker.resize((64, 64), Image.Resampling.LANCZOS)
    favicon_64.save('public/favicon.png', optimize=True)

    # Save 32x32 favicon
    favicon_32 = square_sticker.resize((32, 32), Image.Resampling.LANCZOS)
    favicon_32.save('public/favicon-32.png', optimize=True)

    # Also create base64 for embedding directly inside the SVG
    with open('public/icon-512.png', 'rb') as f:
        b64_data = base64.b64encode(f.read()).decode('utf-8')

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <filter id="appIconShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#1b1b2f" flood-opacity="0.35" />
    </filter>
  </defs>
  <!-- FRIENDZY App Icon Badge -->
  <g filter="url(#appIconShadow)">
    <image href="data:image/png;base64,{b64_data}" x="16" y="16" width="480" height="480" preserveAspectRatio="xMidYMid meet" />
  </g>
</svg>
'''

    with open('public/favicon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

    with open('public/stickers/app-icon.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

    # Also update mark-dice.svg to be this new friendzy brand mark
    with open('public/stickers/mark-dice.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

    print('Successfully generated all icons and SVGs!')

if __name__ == '__main__':
    main()
