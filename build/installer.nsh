; Custom NSIS installer script for Focus
; This script ensures user data is preserved during updates

!macro customInit
  ; Check if this is an upgrade (data directory exists)
  IfFileExists "$INSTDIR\data\*.*" 0 +2
    SetShellVarContext current
!macroend

!macro preInit
  ; Nothing special needed before init
!macroend

!macro customInstall
  ; Check if upgrading from old version with config
  IfFileExists "$INSTDIR\data\db\config.json" 0 CreateDirs
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到旧版本配置文件。$\r$\n$\r$\n是否重置配置？$\r$\n$\r$\n点击[是]将清除 API Key 和免责声明状态，需要重新配置。$\r$\n点击[否]保留现有配置。" IDNO CreateDirs
    Delete "$INSTDIR\data\db\config.json"
  
  CreateDirs:
  ; Create data directory if it doesn't exist
  CreateDirectory "$INSTDIR\data"
  CreateDirectory "$INSTDIR\data\output"
  CreateDirectory "$INSTDIR\data\uploads"
  CreateDirectory "$INSTDIR\data\db"
  CreateDirectory "$INSTDIR\data\logs"
  CreateDirectory "$INSTDIR\data\temp"
  CreateDirectory "$INSTDIR\data\certs"
!macroend

!macro customUnInstall
  ; DO NOT delete the data directory on uninstall
  ; User data should be preserved
  ; Only remove application files, not user data
  
  ; Show message to user about data preservation
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to keep user data (generated images, history, etc.)?$\r$\n$\r$\nClick Yes to keep data, No to delete all data." IDYES KeepData
  
  ; User chose No - delete data
  RMDir /r "$INSTDIR\data"
  Goto Done
    
  KeepData:
    ; Data directory is preserved
    
  Done:
!macroend

!macro customRemoveFiles
  ; Remove only application files, preserve data directory
  ; This is called during upgrade/reinstall
  
  ; Remove old application files but keep data
  RMDir /r "$INSTDIR\resources\app.asar.unpacked"
  Delete "$INSTDIR\resources\app.asar"
  RMDir /r "$INSTDIR\resources\backend"
  
  ; DO NOT remove $INSTDIR\data - this contains user data
!macroend
