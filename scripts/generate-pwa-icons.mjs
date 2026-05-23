import sharp from "sharp"
import { mkdirSync } from "fs"

mkdirSync("public/icons", { recursive: true })

const sizes = [192, 512]
for (const size of sizes) {
  await sharp("public/logo.png")
    .resize(size, size, { fit: "contain", background: { r: 250, g: 248, b: 243, alpha: 1 } })
    .png()
    .toFile(`public/icons/icon-${size}.png`)
  console.log(`✓ icon-${size}.png generated`)
}
