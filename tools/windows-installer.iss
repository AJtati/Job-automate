#define MyAppName "AI Job Search Studio"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AI Job Search Studio"

#ifndef PackageDir
  #error PackageDir must point to the prepared Windows application package.
#endif
#ifndef OutputDir
  #error OutputDir must point to the distribution directory.
#endif

[Setup]
AppId={{9D9C578A-8751-4E89-BAF7-FA4869F9E37B}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\AI Job Search Studio
DefaultGroupName={#MyAppName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=AI-Job-Search-Studio-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#MyAppName}
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "{#PackageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\AI Job Search Studio"; Filename: "{app}\AI Job Search Studio.cmd"; WorkingDir: "{app}"
Name: "{autodesktop}\AI Job Search Studio"; Filename: "{app}\AI Job Search Studio.cmd"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\AI Job Search Studio.cmd"; Description: "Launch AI Job Search Studio"; Flags: postinstall nowait skipifsilent
