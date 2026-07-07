#!/bin/zsh

OBSIDIAN_POSTS="$HOME/Documents/Obsidian Notes/NOTES/00 Posts"
OBSIDIAN_IMAGES="$HOME/Documents/Obsidian Notes/NOTES/98 Images"

VITE_CONTENT_DIR="./public/content"
VITE_IMAGE_DIR="./public/images"

echo "Syncing notes and images from Obsidian..."

rsync -av --delete --exclude="manifest.json" "$OBSIDIAN_POSTS/" "$VITE_CONTENT_DIR/"
rsync -av --delete "$OBSIDIAN_IMAGES/" "$VITE_IMAGE_DIR/"

echo "Committing to Git..."
git add .
git commit -m "update: sync new posts and assets $(date +'%Y-%m-%d')"

echo "Pushing to GitHub..."
git push origin main

echo "Done"