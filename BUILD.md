# Alas — Guia de Build (EAS)

## Pre-requisitos

```bash
npm install -g eas-cli
eas login   # cuenta Expo
```

## 1. Configurar el proyecto en Expo

```bash
cd apps/mobile
eas init    # genera el projectId y lo escribe en app.json
```

Luego reemplazar `YOUR_EAS_PROJECT_ID` en `app.json > extra.eas.projectId` con el valor generado.

## 2. Android — google-services.json

1. Ir a Firebase Console → crear proyecto "Alas"
2. Agregar app Android con package `com.alas.app`
3. Descargar `google-services.json` y copiarlo a `apps/mobile/google-services.json`
4. Agregar SHA-1 del keystore de EAS: `eas credentials`

## 3. iOS — Apple Developer

Necesitas cuenta Apple Developer ($99/ano).
EAS maneja los certificates y provisioning profiles automaticamente con:
```bash
eas credentials --platform ios
```

## 4. Variables de entorno en Railway

Agregar en Railway:
```
ADMIN_USER=admin
ADMIN_PASS=<password-seguro>
```

## 5. Builds

### Development (con DevClient, para testear en dispositivo fisico)
```bash
cd apps/mobile
npm run build:dev
```
Instalar el `.apk` / `.ipa` en el dispositivo y luego `npm start`.

### Preview (distribucion interna)
```bash
npm run build:prev
```
Comparte el link de EAS con testers via QR.

### Production (App Store / Play Store)
```bash
npm run build:prod
```

## 6. Submit

### App Store
```bash
npm run submit:ios
```
Requiere: Apple ID, App Store Connect App ID, Team ID en `eas.json`.

### Google Play
```bash
npm run submit:android
```
Requiere: `google-play-key.json` (Service Account de Google Play Console).

## 7. OTA Updates (sin rebuild)

Para cambios JS sin cambios nativos:
```bash
npm run update
```
Esto publica un update a la rama `production`. Los usuarios lo reciben en el proximo inicio de la app.

## 8. Deep Links

La app registra el scheme `alas://`. Para testear reset-password:
```
alas://reset-password?token=<token>
```

En iOS Simulator:
```bash
xcrun simctl openurl booted "alas://reset-password?token=test"
```

En Android:
```bash
adb shell am start -a android.intent.action.VIEW -d "alas://reset-password?token=test"
```

## 9. Panel Admin

Acceder en: `https://<tu-url-railway>/admin/admin.html`
Usuario y contrasena: las variables `ADMIN_USER` y `ADMIN_PASS` de Railway.
