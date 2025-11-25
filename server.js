
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import { exec } from "child_process";
import FormData from "form-data";

const app = express();
app.use(express.json({ limit: "100mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "public";

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout);
    });
  });
}

async function downloadToTmp(url, filename) {
  const res = await fetch(url);
  const buf = await res.buffer();
  fs.writeFileSync(filename, buf);
}

async function uploadToSupabase(path, fileBuffer) {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`;
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "video/mp4"
    },
    body: fileBuffer
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
}

const templates = {
  celebrity_aggressive: (input, output) => `
    ffmpeg -y -i ${input} -filter_complex "
    [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,
    pad=1080:1920:(ow-iw)/2:(oh-ih)/2,
    eq=contrast=1.05:brightness=0.02:saturation=1.08,
    unsharp=luma_msize_x=5:luma_msize_y=5:luma_amount=1.0[v0];
    [v0]drawtext=text='Pyari Priya • Shop the look':x=20:y=25:
    fontcolor=white:fontsize=36:box=1:boxcolor=black@0.35:boxborderw=8
    " -map "[v0]" -map 0:a -af "loudnorm=I=-14:LRA=7:TP=-2"
    -c:v libx264 -preset slow -b:v 3000k -c:a aac -b:a 128k
    -movflags +faststart ${output}
  `,
};

app.post("/render-final", async (req, res) => {
  try {
    const { input_url, template, output_filename } = req.body;

    const inputTmp = `/tmp/input-${Date.now()}.mp4`;
    await downloadToTmp(input_url, inputTmp);

    const outputTmp = `/tmp/out-${Date.now()}.mp4`;

    const cmd = templates[template](inputTmp, outputTmp);
    await run(cmd);

    const buffer = fs.readFileSync(outputTmp);

    const uploaded = await uploadToSupabase(output_filename, buffer);

    res.json({ output_url: uploaded });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

app.get("/", (_, res) => res.send("FFmpeg Render Server Running"));
app.listen(3000);
