@echo off
echo 🔧 Running Calendar Comments and Reactions Migration...
echo.

REM Change to the migrations directory
cd /d "%~dp0..\migrations"

echo 📁 Current directory: %CD%
echo 📄 Running SQL file: add_calendar_comments_reactions.sql
echo.

REM Run the SQL file using MySQL command line
REM You may need to adjust the MySQL path and credentials
echo ⚠️  Please enter your MySQL root password when prompted
echo.

mysql -u root -p db_ebulletin_system < add_calendar_comments_reactions.sql

echo.
if %ERRORLEVEL% EQU 0 (
    echo ✅ Migration completed successfully!
    echo.
    echo 🎉 Calendar events now support:
    echo   - allow_comments checkbox
    echo   - is_alert checkbox  
    echo   - Reactions/likes
    echo   - Comments
    echo.
    echo 📋 Next steps:
    echo   1. Update your frontend CalendarEventModal to include the new checkboxes
    echo   2. Add reaction buttons to calendar events
    echo   3. Implement comment functionality
) else (
    echo ❌ Migration failed! Please check the error messages above.
    echo.
    echo 💡 Common issues:
    echo   - MySQL is not in your PATH
    echo   - Wrong database name or credentials
    echo   - Database server is not running
    echo.
    echo 🔧 Manual alternative:
    echo   1. Open phpMyAdmin or MySQL Workbench
    echo   2. Select database: db_ebulletin_system
    echo   3. Import the SQL file: migrations/add_calendar_comments_reactions.sql
)

echo.
pause
