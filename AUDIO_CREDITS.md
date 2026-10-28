# Sources des signaux sonores JSB

Le Moniteur JSB utilise désormais **quatre enregistrements sonores réels** sous licence CC0. Aucun ancien bip, carillon ou signal numérique secondaire n’est disponible.

| Signal JSB | Source enregistrée | Auteur / licence |
|---|---|---|
| Sifflet d'arbitre (`whistlePro`) | [Referee whistle blow, gymnasium.wav](https://freesound.org/people/SpliceSound/sounds/218318/) | SpliceSound, CC0 |
| Cloche de ring (`bellSport`) | [Boxing Ring — boxing_matchbell.wav](https://opengameart.org/content/boxing-ring-0) | Umplix, CC0 |
| Buzzer de combat (`buzzerPro`) | [buzzer sportif.wav](https://freesound.org/people/Na%C3%AFma/sounds/510026/) | Naïma, CC0 |
| Corne sportive (`hornPro`) | [airhorn-short.wav](https://freesound.org/people/guitarguy1985/sounds/68999/) | guitarguy1985, CC0 |

**Licence :** ces quatre sources sont indiquées sous Creative Commons Zero (CC0) par leurs diffuseurs. Leur réutilisation commerciale est autorisée sans attribution obligatoire. Les crédits sont néanmoins conservés pour respecter le travail des auteurs. Les sons ne sont pas tirés de Timer Plus ni d'une autre application propriétaire.

**Traitement JSB :** extrait court de la prise de son, mono PCM 22 050 Hz / 16 bits, filtrage, normalisation, légère compression/limitation, fondus d'entrée et de sortie. Le pack est fourni hors ligne dans `assets/audio/` et encodé dans `jsb_audio_samples.js` pour le lecteur web et le pont audio iOS/Android. Les phases de récupération, de décompte et de fin réutilisent ces quatre enregistrements.

**Protection auditive :** les sons sont volontairement nets et percutants, mais le niveau effectif dépend du volume de l'appareil, du haut-parleur et du lieu. Tester d'abord à un volume modéré, spécialement au casque. L'application ne peut pas augmenter le volume matériel maximal et n'assure pas une intelligibilité garantie dans tous les dojos.

**Fichiers d'origine (références GitHub publiques épinglées) :**
- SpliceSound : GodotVR/godot-xr-tools, révision `6c6189bdfcdf855052ef1aeb9f3e0ec4c7a7eb60`.
- Umplix : sergeyt/vifu, révision `c791170cd91df899b59b8fca84ecb99424306851`.
- Naïma : samsonahh/ggj-2026-mask, révision `667423705808e60e87db090cf1b6d44e1b2e3ca0`.
- guitarguy1985 : playroomkit/playroom-godot-kart, révision `9ff64c1a25be1dcab0f78410269550c362569a54`.
