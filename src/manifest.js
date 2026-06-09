#!/usr/bin/env node
// Rebuild docs/data/manifest.json from the week files on disk.
import { writeManifest } from './storage.js';

const manifest = await writeManifest();
console.log(`Manifest: ${manifest.weeks.length} week(s), ${manifest.observationCount} observation(s).`);
