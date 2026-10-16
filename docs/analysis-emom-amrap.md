# Analyse fonctionnelle — EMOM et AMRAP (non intégrés)

Statut : **reporté / analyse uniquement**. Ces modes ne sont pas proposés parmi les choix d'entraînement. Les éventuelles séances historiques restent sauvegardées localement sans migration destructive.

## AMRAP (As Many Rounds/Reps As Possible)

- Principe : fenêtre de travail d'une durée fixe, pendant laquelle on cherche à réaliser un maximum de tours et/ou de répétitions d'un circuit.
- Le minuteur affiche le **temps restant**. L'effort n'est pas découpé en périodes d'effort/repos : l'utilisateur gère sa récupération.
- Le résultat peut être exprimé en **tours complets + répétitions supplémentaires**, plutôt qu'en tours seuls.
- À arbitrer : description du circuit, nombre de mouvements, objectif de performance ou pédagogique, saisie des répétitions partielles, pauses, éventuels signaux d'alerte avant fin.

## EMOM (Every Minute on the Minute)

- Principe : une tâche débute à chaque nouvelle période fixe (souvent 60 s, mais un intervalle de 30/90/120 s est envisageable).
- Si la tâche est terminée avant la fin de la période, le temps restant sert de récupération ; si elle n'est pas terminée, le départ suivant arrive quand même.
- Le chronomètre doit afficher le **numéro de départ**, le **temps restant avant le prochain départ** et la **durée totale de la séance**.
- À arbitrer : travail à chaque période ou alternance de mouvements, durée réglable, comportement quand un tour déborde, multi-exercices, volume, signaux et progression.

## Distinctions techniques et UX

| Comportement | AMRAP | EMOM |
| --- | --- | --- |
| Moteur temporel | Une fenêtre unique | Échéances périodiques absolues |
| Bips | Début, éventuellement fin et alertes | Chaque départ, fin |
| Résultat | Tours/répétitions accomplis | Nombre de départs, travail terminé et récupération |
| Repos | Autogéré | Temps restant avant le prochain départ |
| Progression | Production/volume | Régularité, capacité à respecter la période |

Ces deux modes ne doivent pas être implémentés en réutilisant aveuglément la boucle HIIT « effort → repos ».

## Décision produit actuelle

Priorité à : **Randori, Golden Score, Bips aléatoires et Tabata** (avec HIIT et Boxe conservés). La version web ne montre plus les anciens présets AMRAP/EMOM ni les séances personnalisées de ces types dans la bibliothèque. Aucune donnée historique n'est supprimée.

Avant intégration future, valider les parcours utilisateurs et construire des tests fonctionnels spécifiques pour les deux modes.
