#!/bin/bash

# Create a backup directory
BACKUP_DIR=~/backup
mkdir -p $BACKUP_DIR

# Backup home directory, including .git, .idea, and .vocode
rsync -av \
    --exclude='Cache' \
    --exclude='.cache' \
    --exclude='*/node_modules' \
    --include='.*/' \
    --include='.git/**' \
    --include='.idea/**' \
    --include='.vscode/**' \
    ~/ $BACKUP_DIR/home/

# Backup installed packages list
dpkg --get-selections > $BACKUP_DIR/installed_packages.txt

# Backup repository sources
sudo cp -R /etc/apt/sources.list* $BACKUP_DIR/

# Backup important configuration files from /etc
sudo rsync -av /etc $BACKUP_DIR/etc/

# Backup any data in /var that you need (like websites if you're running a server)
sudo rsync -av /var/www $BACKUP_DIR/var-www/

# Note: If you have databases, you should backup those separately
# Example for MySQL:
# mysqldump -u root -p --all-databases > $BACKUP_DIR/all_databases.sql

echo "Backup completed in $BACKUP_DIR"
