// Combat phase: declare attackers, priority, declare blockers, priority, damage.
// Honors flying-blocking restriction, deathtouch, trample, and the
// "still blocked" rule (MtG 509.1h / 510.1c).
//
// All state lives on the Match — Combat is a free function that reads/writes
// match.combatStep, calls match.priorityLoop / match.dealDamage / match.notify,
// and asks agents for declarations.

export async function runCombatPhase(match) {
  // --- Beginning of combat ---
  // Fire phase_begins for "at the beginning of combat" triggers. Only spin
  // up a priority loop if something actually went on the stack.
  match.combatStep = 'begin';
  await match._firePhaseBegins('combat');
  if (!match.stack.isEmpty) {
    await match.priorityLoop();
    if (match.gameOver) { match.combatStep = null; return; }
  }

  // --- Declare attackers ---
  match.combatStep = 'attackers';
  const eligibleAttackers = match.activePlayer.battlefield.cards.filter(
    c => c.isCreature && !c.tapped && !c.summoningSick
  );
  let attackers = [];
  if (eligibleAttackers.length > 0) {
    match.notify('Declare attackers.');
    attackers = await match.activePlayer.agent.declareAttackers(match);
  }
  for (const c of attackers) c.tapped = true;
  if (attackers.length === 0) {
    match.notify(`${match.activePlayer.name} doesn't attack.`);
    match.combatStep = null;
    return;
  }
  match.notify(`${match.activePlayer.name} attacks with: ${attackers.map(a => a.name).join(', ')}.`);

  // Fire creature_attacks triggers for each attacker. Any resulting triggered
  // abilities sit on the stack to be resolved during the priority window below.
  for (const a of attackers) {
    match._queueTriggersForEvent('creature_attacks', { card: a });
  }
  await match._processPendingTriggers();

  // --- Priority window after attackers declared ---
  match.combatStep = 'after_attackers';
  await match.priorityLoop();
  if (match.gameOver) { match.combatStep = null; return; }
  attackers = attackers.filter(a => a.zone === match.activePlayer.battlefield);
  if (attackers.length === 0) {
    match.notify('No attackers remain.');
    match.combatStep = null;
    return;
  }

  // --- Declare blockers ---
  match.combatStep = 'blockers';
  const eligibleBlockers = match.nonActivePlayer.battlefield.cards.filter(
    c => c.isCreature && !c.tapped
  );
  let blocks = [];
  if (eligibleBlockers.length > 0) {
    match.notify('Declare blockers.');
    blocks = await match.nonActivePlayer.agent.declareBlockers(match, attackers);
  }
  blocks = blocks.filter(({ attacker, blocker }) => {
    if (!canBlock(blocker, attacker)) {
      match.notify(`${blocker.name} can't block ${attacker.name}.`);
      return false;
    }
    return true;
  });

  // Snapshot which attackers were blocked BEFORE the priority window so the
  // "still blocked" rule applies if blockers are killed mid-priority.
  const blockedAttackers = new Set(blocks.map(b => b.attacker));

  // --- Priority window after blockers declared ---
  match.combatStep = 'after_blockers';
  await match.priorityLoop();
  if (match.gameOver) { match.combatStep = null; return; }

  // --- Combat damage ---
  match.combatStep = 'damage';
  for (const attacker of attackers) {
    if (attacker.zone !== match.activePlayer.battlefield) continue;

    const livingBlockers = blocks
      .filter(b =>
        b.attacker === attacker &&
        b.blocker.zone === match.nonActivePlayer.battlefield
      )
      .map(b => b.blocker);

    const wasBlocked = blockedAttackers.has(attacker);

    if (!wasBlocked) {
      match.dealDamage(attacker, match.nonActivePlayer, attacker.power);
    } else if (livingBlockers.length === 0) {
      // "Still blocked" — no damage unless trample.
      if (attacker.hasKeyword('trample')) {
        match.dealDamage(attacker, match.nonActivePlayer, attacker.power);
      } else {
        match.notify(`${attacker.name} was blocked; all blockers gone — no damage.`);
      }
    } else {
      // Assign damage to blockers in declared order. Each non-last blocker
      // gets exactly lethal (1 with deathtouch, else remaining toughness).
      // The LAST blocker absorbs all remaining damage (without trample) or
      // exactly its lethal (with trample, so excess goes to the defender).
      // Assigning the full damage matters when a replacement effect like
      // Smokeweaver later reduces the amount — a 3-power attacker still
      // kills a 1-toughness blocker even when 1 damage is prevented.
      const trample = attacker.hasKeyword('trample');
      const deathtouch = attacker.hasKeyword('deathtouch');
      let remaining = attacker.power;
      for (let i = 0; i < livingBlockers.length; i++) {
        const b = livingBlockers[i];
        const isLast = i === livingBlockers.length - 1;
        const lethal = deathtouch ? 1 : Math.max(1, b.toughness - b.damage);
        const dmg = (isLast && !trample) ? remaining : Math.min(remaining, lethal);
        match.dealDamage(attacker, b, dmg);
        remaining -= dmg;
      }
      if (trample && remaining > 0) {
        match.dealDamage(attacker, match.nonActivePlayer, remaining);
      }
      for (const b of livingBlockers) {
        match.dealDamage(b, attacker, b.power);
      }
    }
  }

  match.combatStep = null;
  await match.checkStateBasedActions();
}

// Returns true if `blocker` is legally able to block `attacker`.
export function canBlock(blocker, attacker) {
  if (attacker.hasKeyword('flying') && !blocker.hasKeyword('flying')) return false;
  if (attacker.hasKeyword('fear')) {
    const isBlack = blocker.def.color === 'B';
    const isToken = !!blocker.def.isToken;
    if (!isBlack && !isToken) return false;
  }
  return true;
}
