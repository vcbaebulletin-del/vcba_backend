@echo off
REM Setup Archival Windows Task Scheduler Script
REM This script sets up automated archival of expired content every 5 minutes using Windows Task Scheduler
REM Run this script as Administrator

setlocal enabledelayedexpansion

REM Configuration
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "ARCHIVAL_SCRIPT=%PROJECT_DIR%\scripts\auto-archive-expired-content.js"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "TASK_LOG_FILE=%LOG_DIR%\archival-task.log"
set "TASK_NAME=VCBA-Content-Archival"

echo [94m🔧 Setting up automatic content archival Windows Task...[0m

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [91m❌ This script must be run as Administrator.[0m
    echo [93mRight-click and select "Run as administrator"[0m
    pause
    exit /b 1
)

echo [92m✅ Running as Administrator[0m

REM Check if Node.js is installed
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [91m❌ Node.js not found. Please install Node.js first.[0m
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('where node') do set "NODE_PATH=%%i"
echo [92m✅ Node.js found at: %NODE_PATH%[0m

REM Check if archival script exists
if not exist "%ARCHIVAL_SCRIPT%" (
    echo [91m❌ Archival script not found at: %ARCHIVAL_SCRIPT%[0m
    pause
    exit /b 1
)

echo [92m✅ Archival script found[0m

REM Create logs directory if it doesn't exist
if not exist "%LOG_DIR%" (
    mkdir "%LOG_DIR%"
    echo [92m✅ Created logs directory: %LOG_DIR%[0m
)

REM Test the archival script
echo [93m🧪 Testing archival script...[0m
cd /d "%PROJECT_DIR%"
"%NODE_PATH%" "%ARCHIVAL_SCRIPT%" >nul 2>&1
if %errorLevel% neq 0 (
    echo [91m❌ Archival script test failed. Please check the script and database connection.[0m
    pause
    exit /b 1
)

echo [92m✅ Archival script test successful[0m

REM Delete existing task if it exists
schtasks /query /tn "%TASK_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo [93m⚠️ Existing task found. Deleting...[0m
    schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
)

REM Create the scheduled task
echo [94m📅 Creating scheduled task...[0m

REM Create task XML configuration
set "TASK_XML=%TEMP%\vcba-archival-task.xml"

(
echo ^<?xml version="1.0" encoding="UTF-16"?^>
echo ^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^>
echo   ^<RegistrationInfo^>
echo     ^<Description^>VCBA E-Bulletin Board Content Archival - Archives expired announcements and calendar events every 5 minutes^</Description^>
echo     ^<Author^>VCBA System^</Author^>
echo   ^</RegistrationInfo^>
echo   ^<Triggers^>
echo     ^<TimeTrigger^>
echo       ^<Repetition^>
echo         ^<Interval^>PT5M^</Interval^>
echo       ^</Repetition^>
echo       ^<StartBoundary^>2025-01-01T00:00:00^</StartBoundary^>
echo       ^<Enabled^>true^</Enabled^>
echo     ^</TimeTrigger^>
echo   ^</Triggers^>
echo   ^<Principals^>
echo     ^<Principal id="Author"^>
echo       ^<LogonType^>InteractiveToken^</LogonType^>
echo       ^<RunLevel^>LeastPrivilege^</RunLevel^>
echo     ^</Principal^>
echo   ^</Principals^>
echo   ^<Settings^>
echo     ^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^>
echo     ^<DisallowStartIfOnBatteries^>false^</DisallowStartIfOnBatteries^>
echo     ^<StopIfGoingOnBatteries^>false^</StopIfGoingOnBatteries^>
echo     ^<AllowHardTerminate^>true^</AllowHardTerminate^>
echo     ^<StartWhenAvailable^>true^</StartWhenAvailable^>
echo     ^<RunOnlyIfNetworkAvailable^>false^</RunOnlyIfNetworkAvailable^>
echo     ^<IdleSettings^>
echo       ^<StopOnIdleEnd^>false^</StopOnIdleEnd^>
echo       ^<RestartOnIdle^>false^</RestartOnIdle^>
echo     ^</IdleSettings^>
echo     ^<AllowStartOnDemand^>true^</AllowStartOnDemand^>
echo     ^<Enabled^>true^</Enabled^>
echo     ^<Hidden^>false^</Hidden^>
echo     ^<RunOnlyIfIdle^>false^</RunOnlyIfIdle^>
echo     ^<WakeToRun^>false^</WakeToRun^>
echo     ^<ExecutionTimeLimit^>PT10M^</ExecutionTimeLimit^>
echo     ^<Priority^>7^</Priority^>
echo   ^</Settings^>
echo   ^<Actions Context="Author"^>
echo     ^<Exec^>
echo       ^<Command^>"%NODE_PATH%"^</Command^>
echo       ^<Arguments^>"%ARCHIVAL_SCRIPT%"^</Arguments^>
echo       ^<WorkingDirectory^>%PROJECT_DIR%^</WorkingDirectory^>
echo     ^</Exec^>
echo   ^</Actions^>
echo ^</Task^>
) > "%TASK_XML%"

REM Import the task
schtasks /create /tn "%TASK_NAME%" /xml "%TASK_XML%" /f
if %errorLevel% neq 0 (
    echo [91m❌ Failed to create scheduled task[0m
    del "%TASK_XML%" >nul 2>&1
    pause
    exit /b 1
)

REM Clean up temporary XML file
del "%TASK_XML%" >nul 2>&1

echo [92m✅ Scheduled task created successfully![0m

REM Display task information
echo [94m📋 Task Information:[0m
schtasks /query /tn "%TASK_NAME%" /fo LIST /v | findstr /C:"TaskName" /C:"Status" /C:"Next Run Time" /C:"Last Run Time"

REM Create monitoring batch file
set "MONITOR_SCRIPT=%SCRIPT_DIR%monitor-archival.bat"
(
echo @echo off
echo REM Monitor Archival Process Script
echo REM This script helps monitor the archival process and logs
echo.
echo setlocal
echo set "LOG_DIR=%%~dp0..\logs"
echo set "TASK_LOG_FILE=%%LOG_DIR%%\archival-task.log"
echo set "TASK_NAME=VCBA-Content-Archival"
echo.
echo echo [94m📊 VCBA Content Archival Monitor[0m
echo echo ==================================
echo.
echo REM Check if task exists and is enabled
echo schtasks /query /tn "%%TASK_NAME%%" ^>nul 2^>^&1
echo if %%errorLevel%% equ 0 ^(
echo     echo [92m✅ Scheduled task is active[0m
echo     schtasks /query /tn "%%TASK_NAME%%" /fo LIST /v ^| findstr /C:"Status" /C:"Next Run Time" /C:"Last Run Time"
echo ^) else ^(
echo     echo [93m⚠️ Scheduled task not found[0m
echo ^)
echo.
echo REM Show recent log entries if log file exists
echo if exist "%%TASK_LOG_FILE%%" ^(
echo     echo.
echo     echo [94m📋 Recent archival log entries ^(last 20 lines^):[0m
echo     echo ================================================
echo     powershell "Get-Content '%%TASK_LOG_FILE%%' -Tail 20"
echo ^) else ^(
echo     echo [93m⚠️ Log file not found: %%TASK_LOG_FILE%%[0m
echo ^)
echo.
echo echo.
echo echo [94m🔧 Management Commands:[0m
echo echo • Run manually: schtasks /run /tn "%%TASK_NAME%%"
echo echo • Stop task: schtasks /end /tn "%%TASK_NAME%%"
echo echo • Delete task: schtasks /delete /tn "%%TASK_NAME%%" /f
echo echo • View logs: type "%%TASK_LOG_FILE%%"
echo.
echo pause
) > "%MONITOR_SCRIPT%"

echo [92m✅ Monitoring script created: %MONITOR_SCRIPT%[0m

REM Create manual run script
set "MANUAL_RUN_SCRIPT=%SCRIPT_DIR%run-archival-manually.bat"
(
echo @echo off
echo REM Manual Archival Run Script
echo REM This script runs the archival process manually for testing
echo.
echo setlocal
echo set "PROJECT_DIR=%%~dp0.."
echo set "ARCHIVAL_SCRIPT=%%PROJECT_DIR%%\scripts\auto-archive-expired-content.js"
echo.
echo echo [94m🔧 Running VCBA Content Archival manually...[0m
echo echo ============================================
echo.
echo cd /d "%%PROJECT_DIR%%"
echo node "%%ARCHIVAL_SCRIPT%%"
echo.
echo echo.
echo echo [92m✅ Manual archival run completed[0m
echo pause
) > "%MANUAL_RUN_SCRIPT%"

echo [92m✅ Manual run script created: %MANUAL_RUN_SCRIPT%[0m

echo.
echo [92m🎉 Archival Windows Task setup completed![0m
echo.
echo [94m📋 Summary:[0m
echo • Task Name: %TASK_NAME%
echo • Runs every 5 minutes
echo • Monitor with: %MONITOR_SCRIPT%
echo • Run manually with: %MANUAL_RUN_SCRIPT%
echo • Or use: schtasks /run /tn "%TASK_NAME%"
echo.
echo [93m⚠️ Important Notes:[0m
echo • Make sure the database is accessible
echo • Check task logs regularly
echo • The archival process uses Asia/Manila timezone
echo • Archived content is excluded from public APIs automatically
echo.

pause
