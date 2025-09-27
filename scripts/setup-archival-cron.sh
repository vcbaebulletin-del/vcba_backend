#!/bin/bash

# Setup Archival Cron Job Script
# This script sets up automated archival of expired content every 5 minutes
# Run this script as the user who will execute the archival process

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ARCHIVAL_SCRIPT="$PROJECT_DIR/scripts/auto-archive-expired-content.js"
LOG_DIR="$PROJECT_DIR/logs"
CRON_LOG_FILE="$LOG_DIR/archival-cron.log"
NODE_PATH=$(which node)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up automatic content archival cron job...${NC}"

# Check if Node.js is installed
if [ ! -f "$NODE_PATH" ]; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js found at: $NODE_PATH${NC}"

# Check if archival script exists
if [ ! -f "$ARCHIVAL_SCRIPT" ]; then
    echo -e "${RED}❌ Archival script not found at: $ARCHIVAL_SCRIPT${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Archival script found${NC}"

# Create logs directory if it doesn't exist
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    echo -e "${GREEN}✅ Created logs directory: $LOG_DIR${NC}"
fi

# Test the archival script
echo -e "${YELLOW}🧪 Testing archival script...${NC}"
cd "$PROJECT_DIR"
if $NODE_PATH "$ARCHIVAL_SCRIPT" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Archival script test successful${NC}"
else
    echo -e "${RED}❌ Archival script test failed. Please check the script and database connection.${NC}"
    exit 1
fi

# Create the cron job entry
CRON_ENTRY="*/5 * * * * cd $PROJECT_DIR && $NODE_PATH $ARCHIVAL_SCRIPT >> $CRON_LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "auto-archive-expired-content.js"; then
    echo -e "${YELLOW}⚠️ Archival cron job already exists. Updating...${NC}"
    # Remove existing cron job
    crontab -l 2>/dev/null | grep -v "auto-archive-expired-content.js" | crontab -
fi

# Add the new cron job
(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -

echo -e "${GREEN}✅ Cron job added successfully!${NC}"

# Display current crontab
echo -e "${BLUE}📋 Current crontab entries:${NC}"
crontab -l

# Create a systemd service file (optional alternative to cron)
SYSTEMD_SERVICE_FILE="/tmp/vcba-archival.service"
SYSTEMD_TIMER_FILE="/tmp/vcba-archival.timer"

cat > "$SYSTEMD_SERVICE_FILE" << EOF
[Unit]
Description=VCBA E-Bulletin Board Content Archival Service
After=network.target

[Service]
Type=oneshot
User=$(whoami)
WorkingDirectory=$PROJECT_DIR
ExecStart=$NODE_PATH $ARCHIVAL_SCRIPT
StandardOutput=append:$CRON_LOG_FILE
StandardError=append:$CRON_LOG_FILE

[Install]
WantedBy=multi-user.target
EOF

cat > "$SYSTEMD_TIMER_FILE" << EOF
[Unit]
Description=Run VCBA Content Archival every 5 minutes
Requires=vcba-archival.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOF

echo -e "${BLUE}📄 Systemd service files created (optional alternative to cron):${NC}"
echo -e "Service file: $SYSTEMD_SERVICE_FILE"
echo -e "Timer file: $SYSTEMD_TIMER_FILE"
echo ""
echo -e "${YELLOW}To use systemd instead of cron (requires sudo):${NC}"
echo -e "sudo cp $SYSTEMD_SERVICE_FILE /etc/systemd/system/"
echo -e "sudo cp $SYSTEMD_TIMER_FILE /etc/systemd/system/"
echo -e "sudo systemctl daemon-reload"
echo -e "sudo systemctl enable vcba-archival.timer"
echo -e "sudo systemctl start vcba-archival.timer"
echo ""

# Create monitoring script
MONITOR_SCRIPT="$SCRIPT_DIR/monitor-archival.sh"
cat > "$MONITOR_SCRIPT" << 'EOF'
#!/bin/bash

# Monitor Archival Process Script
# This script helps monitor the archival process and logs

LOG_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")/logs"
CRON_LOG_FILE="$LOG_DIR/archival-cron.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 VCBA Content Archival Monitor${NC}"
echo "=================================="

# Check if cron job is active
if crontab -l 2>/dev/null | grep -q "auto-archive-expired-content.js"; then
    echo -e "${GREEN}✅ Cron job is active${NC}"
else
    echo -e "${YELLOW}⚠️ Cron job not found${NC}"
fi

# Show recent log entries
if [ -f "$CRON_LOG_FILE" ]; then
    echo ""
    echo -e "${BLUE}📋 Recent archival log entries (last 20 lines):${NC}"
    echo "================================================"
    tail -n 20 "$CRON_LOG_FILE"
else
    echo -e "${YELLOW}⚠️ Log file not found: $CRON_LOG_FILE${NC}"
fi

# Show cron job schedule
echo ""
echo -e "${BLUE}⏰ Current cron schedule:${NC}"
echo "=========================="
crontab -l 2>/dev/null | grep "auto-archive-expired-content.js" || echo "No archival cron job found"
EOF

chmod +x "$MONITOR_SCRIPT"
echo -e "${GREEN}✅ Monitoring script created: $MONITOR_SCRIPT${NC}"

# Create log rotation configuration
LOGROTATE_CONFIG="/tmp/vcba-archival-logrotate"
cat > "$LOGROTATE_CONFIG" << EOF
$CRON_LOG_FILE {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 $(whoami) $(whoami)
}
EOF

echo -e "${BLUE}📄 Log rotation config created: $LOGROTATE_CONFIG${NC}"
echo -e "${YELLOW}To enable log rotation (requires sudo):${NC}"
echo -e "sudo cp $LOGROTATE_CONFIG /etc/logrotate.d/vcba-archival"
echo ""

echo -e "${GREEN}🎉 Archival cron job setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Summary:${NC}"
echo "• Archival runs every 5 minutes"
echo "• Logs are written to: $CRON_LOG_FILE"
echo "• Monitor with: $MONITOR_SCRIPT"
echo "• Test manually with: cd $PROJECT_DIR && $NODE_PATH $ARCHIVAL_SCRIPT"
echo ""
echo -e "${YELLOW}⚠️ Important Notes:${NC}"
echo "• Make sure the database is accessible from this user account"
echo "• Check logs regularly to ensure archival is working correctly"
echo "• The archival process uses Asia/Manila timezone"
echo "• Archived content is excluded from public APIs automatically"
