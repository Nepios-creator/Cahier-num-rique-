/* v44 : mise en page propre du bloc « Rappel quotidien » des cartes de révision (heure sur toute la largeur, deux boutons égaux dessous, textes qui ne dépassent plus). Style seulement : aucune fonction modifiée. À charger après cahier-cartes.js. */
(function(){
var s=document.createElement('style');s.id='v44css';
s.textContent='#cnc1 #cc1t{flex:1 1 100%;box-sizing:border-box;width:100%;min-width:0;height:52px;padding:0 16px;border-radius:14px;font-size:20px;font-weight:600;font-family:inherit}'
+'#cnc1 #cc1n,#cnc1 #cc1i{flex:1 1 calc(50% - 4px);box-sizing:border-box;min-width:0;min-height:48px;padding:10px 12px;border-radius:14px;font-size:15px;font-weight:600;line-height:1.25;text-align:center;white-space:normal;overflow-wrap:anywhere;display:flex;align-items:center;justify-content:center}';
document.head.appendChild(s);
})();
