import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() => runApp(const MoniteurApp());

class Workout {
  const Workout(this.name, this.prep, this.work, this.rest, this.cycles);
  final String name;
  final int prep, work, rest, cycles;
  int get seconds => prep + work * cycles + rest * (cycles - 1);
  Map<String, dynamic> toJson() => {'name':name,'prep':prep,'work':work,'rest':rest,'cycles':cycles};
  factory Workout.fromJson(Map<String, dynamic> j) => Workout(j['name'] as String,j['prep'] as int,j['work'] as int,j['rest'] as int,j['cycles'] as int);
}

class Phase {
  const Phase(this.label,this.seconds,this.cycle);
  final String label;
  final int seconds, cycle;
}
List<Phase> phasesFor(Workout w) => [
  if(w.prep>0) Phase('PRÉPARATION',w.prep,0),
  for(int i=1;i<=w.cycles;i++) ...[
    Phase('EFFORT',w.work,i),
    if(i<w.cycles && w.rest>0) Phase('REPOS',w.rest,i),
  ]
];

class MoniteurApp extends StatelessWidget {
  const MoniteurApp({super.key});
  @override Widget build(BuildContext context)=> MaterialApp(
    title:'Moniteur JSB',debugShowCheckedModeBanner:false,
    theme:ThemeData(colorScheme:ColorScheme.fromSeed(seedColor:const Color(0xFF0369A1),brightness:Brightness.dark),useMaterial3:true),
    home:const HomeScreen(),
  );
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override State<HomeScreen> createState()=>_HomeScreenState();
}
class _HomeScreenState extends State<HomeScreen> {
  List<Workout> workouts=[
    const Workout('Tabata classique',10,20,10,8),
    const Workout('HIIT 30/15',10,30,15,10),
  ];
  List<String> history=[];
  @override void initState(){super.initState();_load();}
  Future<void> _load() async{
    final p=await SharedPreferences.getInstance();
    if(!mounted)return;
    setState((){
      final saved=p.getStringList('workouts');
      if(saved!=null){try{workouts=saved.map((s)=>Workout.fromJson(jsonDecode(s) as Map<String,dynamic>)).toList();}catch(_){}}
      history=p.getStringList('history')??[];
    });
  }
  Future<void> _save() async{
    final p=await SharedPreferences.getInstance();
    await p.setStringList('workouts',workouts.map((w)=>jsonEncode(w.toJson())).toList());
    await p.setStringList('history',history);
  }
  Future<void> _start(Workout w) async{
    final result=await Navigator.push<bool>(context,MaterialPageRoute(builder:(_)=>TimerScreen(workout:w)));
    if(result==null || !mounted)return;
    setState(()=>history.insert(0,'${DateTime.now().toLocal().toString().substring(0,16)} · ${w.name} · ${result?'Terminée':'Interrompue'}'));
    await _save();
  }
  Future<void> _edit([Workout? existing]) async{
    final result=await Navigator.push<Workout>(context,MaterialPageRoute(builder:(_)=>EditorScreen(workout:existing)));
    if(result==null || !mounted)return;
    setState((){
      if(existing==null)workouts.add(result);
      else workouts[workouts.indexOf(existing)]=result;
    });
    await _save();
  }
  @override Widget build(BuildContext context)=>DefaultTabController(length:2,child:Scaffold(
    appBar:AppBar(title:const Text('Moniteur JSB'),bottom:const TabBar(tabs:[Tab(text:'Séances',icon:Icon(Icons.timer)),Tab(text:'Historique',icon:Icon(Icons.history))])),
    body:TabBarView(children:[
      ListView(padding:const EdgeInsets.all(16),children:[
        for(final w in workouts) Card(child:ListTile(
          title:Text(w.name),subtitle:Text('${w.cycles} cycles · ${w.seconds}s'),
          trailing:IconButton(tooltip:'Modifier ${w.name}',icon:const Icon(Icons.edit),onPressed:()=>_edit(w)),
          onTap:()=>_start(w))),
      ]),
      history.isEmpty?const Center(child:Text('Aucune séance enregistrée')):ListView(children:[for(final h in history)ListTile(title:Text(h))]),
    ]),
    floatingActionButton:FloatingActionButton.extended(onPressed:()=>_edit(),icon:const Icon(Icons.add),label:const Text('Nouvelle séance')),
  ));
}

class EditorScreen extends StatefulWidget{
  const EditorScreen({super.key,this.workout});
  final Workout? workout;
  @override State<EditorScreen> createState()=>_EditorScreenState();
}
class _EditorScreenState extends State<EditorScreen>{
  late final name=TextEditingController(text:widget.workout?.name??'Ma séance');
  late final prep=TextEditingController(text:'${widget.workout?.prep??10}');
  late final work=TextEditingController(text:'${widget.workout?.work??30}');
  late final rest=TextEditingController(text:'${widget.workout?.rest??15}');
  late final cycles=TextEditingController(text:'${widget.workout?.cycles??8}');
  @override void dispose(){for(final c in [name,prep,work,rest,cycles])c.dispose();super.dispose();}
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:Text(widget.workout==null?'Nouvelle séance':'Modifier la séance')),
    body:ListView(padding:const EdgeInsets.all(20),children:[
      TextField(controller:name,decoration:const InputDecoration(labelText:'Nom')),
      for(final field in [(prep,'Préparation (secondes)'),(work,'Effort (secondes)'),(rest,'Repos (secondes)'),(cycles,'Cycles')])
        TextField(controller:field.$1,keyboardType:TextInputType.number,decoration:InputDecoration(labelText:field.$2)),
      const SizedBox(height:24),
      FilledButton(onPressed:(){
        final p=int.tryParse(prep.text),w=int.tryParse(work.text),r=int.tryParse(rest.text),c=int.tryParse(cycles.text);
        if(name.text.trim().isEmpty||p==null||w==null||r==null||c==null||p<0||w<=0||r<0||c<=0||c>1000){
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Vérifiez les champs : effort et cycles doivent être positifs.')));return;
        }
        Navigator.pop(context,Workout(name.text.trim(),p,w,r,c));
      },child:const Text('Enregistrer'))
    ]));
}

class TimerScreen extends StatefulWidget{
  const TimerScreen({super.key,required this.workout});
  final Workout workout;
  @override State<TimerScreen> createState()=>_TimerScreenState();
}
class _TimerScreenState extends State<TimerScreen>{
  late final List<Phase> phases=phasesFor(widget.workout);
  final watch=Stopwatch();
  Timer? ticker;
  int index=0,remaining=0;
  bool finished=false;
  int phaseStartMs=0;
  @override void initState(){super.initState();remaining=phases.first.seconds;watch.start();ticker=Timer.periodic(const Duration(milliseconds:80),(_)=>_tick());}
  void _tick(){
    if(!watch.isRunning||finished)return;
    final elapsed=watch.elapsedMilliseconds;
    var next=index;
    var start=phaseStartMs;
    while(next<phases.length && elapsed-start>=phases[next].seconds*1000){
      start+=phases[next].seconds*1000;next++;
    }
    if(next>=phases.length){_finish(true);return;}
    if(next!=index){SystemSound.play(SystemSoundType.click);HapticFeedback.mediumImpact();}
    if(mounted)setState((){index=next;phaseStartMs=start;remaining=((phases[index].seconds*1000-(elapsed-start)+999)~/1000).clamp(0,phases[index].seconds);});
  }
  void _finish(bool completed){if(finished)return;finished=true;watch.stop();ticker?.cancel();Navigator.pop(context,completed);}
  @override void dispose(){ticker?.cancel();watch.stop();super.dispose();}
  Future<void> _stop() async{
    final ok=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(title:const Text('Arrêter la séance ?'),content:const Text('La séance sera enregistrée comme interrompue.'),actions:[
      TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Continuer')),
      FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Arrêter'))]));
    if(ok==true&&mounted)_finish(false);
  }
  @override Widget build(BuildContext context){
    final phase=phases[index];
    final color=switch(phase.label){'EFFORT'=>const Color(0xFF126A3D),'REPOS'=>const Color(0xFF922D2D),_=>const Color(0xFF94600B)};
    return PopScope(canPop:false,child:Scaffold(backgroundColor:color,body:SafeArea(child:Padding(padding:const EdgeInsets.all(24),child:Column(children:[
      const Spacer(),Text(phase.label,style:const TextStyle(fontSize:28,fontWeight:FontWeight.bold)),
      const SizedBox(height:20),
      Semantics(label:'${remaining} secondes restantes',child:FittedBox(child:Text('${(remaining~/60).toString().padLeft(2,'0')}:${(remaining%60).toString().padLeft(2,'0')}',style:const TextStyle(fontSize:112,fontWeight:FontWeight.w800,fontFeatures:[FontFeature.tabularFigures()])))),
      Text('Cycle ${phase.cycle} sur ${widget.workout.cycles}',style:const TextStyle(fontSize:19)),
      const Spacer(),
      LinearProgressIndicator(value:1-remaining/phase.seconds,minHeight:12),
      const SizedBox(height:36),
      Row(children:[
        Expanded(child:FilledButton.tonalIcon(onPressed:(){setState((){watch.isRunning?watch.stop():watch.start();});},icon:Icon(watch.isRunning?Icons.pause:Icons.play_arrow),label:Text(watch.isRunning?'Pause':'Reprendre'))),
        const SizedBox(width:16),
        Expanded(child:OutlinedButton.icon(onPressed:_stop,icon:const Icon(Icons.stop),label:const Text('Arrêter'))),
      ]),
      const SizedBox(height:20),
    ])))));
  }
}
