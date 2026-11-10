const {test}=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('./context-lesson.js');
test('hides every occurrence, preserving punctuation and case',()=>{
 const q=create({en:'forest',example:'Forest, a quiet forest.'});
 assert.equal(q.parts.filter(p=>p.blank).length,2);
 assert.equal(q.parts.map(p=>p.blank?'___':p.text).join(''),'___, a quiet ___.');
 assert.equal(q.parts.map(p=>p.text).join(''),q.sentence);
});
test('does not match parts of longer words, possessives or compounds',()=>{
 for(const example of ['A forester came.',"The forest’s edge.",'A forest-like place.','A forest2 label.'])assert.equal(create({en:'forest',example}),null);
});
test('literal regex characters and phrases',()=>{
 assert.ok(create({en:'C++',example:'I use C++ every day.'}));
 assert.ok(create({en:'look up',example:'Please look   up this word.'}));
 assert.equal(create({en:'a.b',example:'An axb here.'}),null);
});
test('requires a sentence, not a word or empty example',()=>{
 for(const example of ['', 'forest', 'FOREST!', 'forest forest']) assert.equal(create({en:'forest',example}),null);
});
test('no matching form means no invented question',()=>{
 assert.equal(create({en:'wander',example:'She wandered home.'}),null);
});
test('unicode boundaries, newlines and long examples',()=>{
 assert.equal(create({en:'cat',example:'A caté here.'}),null);
 assert.ok(create({en:'cat',example:'A cat\nsat down.'}));
 assert.equal(create({en:'cat',example:'cat '+ 'x'.repeat(2000)}),null);
});
