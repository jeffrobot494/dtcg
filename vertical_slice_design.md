# Vertical Slice Design: Black Mage Expedition

## 1. Purpose of the Vertical Slice

This vertical slice is designed to test the core identity of the game: a single-player adventure built around a Magic: The Gathering-style card battle system where every battle permanently changes the player's deck and collection.

The prototype is not meant to test full real-time exploration yet. It is meant to test whether the adventure layer creates interesting strategic pressure around the card battle system.

The main mechanics being tested are:

- **Permanent card attrition:** At the end of each battle, all cards in the player's graveyard are permanently removed from both the deck and collection.
- **Persistent life total:** The player's life total carries forward between battles.
- **No free healing:** The player does not passively heal at camp, after battles, or between nodes. Healing only comes from cards, healing items, or crafted healing items.
- **Enemy deck looting:** When the player defeats an enemy sorceror, the player gains all cards remaining in that sorceror's deck.
- **Optional risk/reward encounters:** Legendary creatures, treasure monsters, and the village raid offer power at a cost.
- **Deck rebuilding:** The player can replenish and reshape the deck through crafting, merchant purchases, enemy deck rewards, and special encounters.
- **Restricted crafting:** Creature cards cannot be crafted. Only instants, sorceries, enchantments, artifacts, and healing items can be crafted.
- **Equipment choices:** The player can equip one ring, one amulet, and one staff, forcing strategic tradeoffs.
- **Open node selection:** From the start of the slice, every node is visible and available. The player chooses the order of encounters freely.

The player should constantly be asking:

> What should I risk now so that I am strong enough for the final battle later?

The central tension is that almost every source of power also requires spending power. Fighting sorcerors wins cards but costs life and cards. Fighting monsters wins materials and equipment but taxes resources. Crafting can replace lost spells, but healing items and crafted cards compete for the same materials. Raiding the village gives creatures, but may unleash a dangerous Paladin consequence later.

---

## 2. Format: Camp-Based Node Map

For the prototype, the overworld is a **camp-based node map**, not a real-time 2D exploration space.

The player does not physically travel from node to node. Instead, the camp acts as the central interface. From camp, the player chooses any available node on the map. The player resolves that node, then returns to camp unless the node has special rules that prevent this.

This structure keeps the prototype focused on strategic decisions rather than navigation implementation.

### Core Node Flow

1. The player is at camp.
2. The player chooses any visible node on the map.
3. The selected node resolves: battle, merchant, village raid, crafting, boss challenge, etc.
4. If the player survives and the node does not impose a special restriction, the player returns to camp.
5. The merchant's wares refresh each time the player clears a node.
6. The player may craft, edit deck, equip items, use healing items, or choose another node.

### Important Exception: The Cave

The cave is a commitment node.

When the player enters the cave, the cave collapses behind them. The player must defeat two sorcerors back-to-back without returning to camp, visiting the merchant, crafting, changing equipment, or using out-of-battle healing between the two fights.

This creates a compact expedition inside the larger node map.

### Important Exception: The Boss Battle

The boss battle begins against two full-powered red mages. When one of them falls below a defined life threshold, the third red mage arrives and blocks the player's retreat. From that point onward, the player can no longer retreat from the boss battle.

---

## 3. High-Level Map Contents

The vertical slice contains:

- 1 player camp / crafting hub
- 1 merchant
- 1 village raid node
- 5 enemy sorceror battles
  - 3 solo sorcerors available as individual nodes
  - 2 sorcerors inside a collapsing cave, fought back-to-back without recovery
  - 4 red sorcerors total across the map
  - 1 black sorceror battle
- 3 legendary creature battles
- 5 smaller monster battles guarding treasure
- 1 final boss battle against three full-powered red mages

Total possible major engagements:

- 5 sorceror battles
- 3 legendary creature battles
- 5 treasure monster battles
- 1 boss battle
- 1 optional village raid consequence chain

The player does not need to complete every encounter before challenging the boss, but the boss should be difficult enough that a poorly prepared player is unlikely to win.

---

## 4. Core Player Starting State

The player is a black mage.

### Starting Deck

The player begins with a mono-black deck. The deck should include:

- Small disposable creatures
- Some life drain effects
- A few removal spells
- A few graveyard or sacrifice synergies
- Limited card draw
- Limited ways to recover life

The starting deck should be strong enough to beat early sorcerors or weaker monster nodes, but not strong enough to comfortably defeat the boss without preparation.

### Starting Life

The player begins at **20 life**.

Life persists between battles. If the player ends a battle at 5 life, the next battle begins at 5 life.

The player may be able to increase life above 20 through black lifegain effects. This is important because entering the boss fight with a very high life total is one of the main ways to overcome the boss's action advantage.

### Starting Healing

The player begins with **one healing item**.

This gives the player a small safety buffer, but it should not remove the pressure of persistent life loss.

Example starter item:

- **Bloodroot Poultice:** Use at camp to gain 6 life.

### Starting Equipment

The player may begin with no equipment, or with a weak starter ring.

A clean prototype approach is:

- Start with no ring
- Start with no amulet
- Start with no staff

This makes equipment discoveries feel more important.

---

### Note on Retreating

The player generally has the option to retreat. 
- Retreating can only be done on the player's turn when the stack is empty. 
- Any cards in the player's graveyard are lost.
- Any cards on the battlefield are lost.

There are three times when the player cannot retreat from battle. 
- The first is in the cave node where they have to defeat both sorcerors
- The second is after the first stage of the Boss fight when the third red sorceror shows up. 
- The third is if the Paladin joins a battle against them. 

## 5. Healing Rules

Healing is intentionally scarce.

There is no passive healing and no automatic recovery.

The player does **not** heal:

- After winning a battle
- After returning to camp
- After clearing a node
- After visiting the merchant
- After crafting
- Before entering the boss battle

The player can recover life through:

- Life-gain cards during battle
- Healing items used at camp
- Crafted healing items
- Equipment effects that explicitly gain life
- Certain rewards, if intentionally included

### Healing Items and Crafting Pressure

Healing items can be crafted, but they use the same materials as crafted cards.

This creates an important strategic tension:

> Do I spend my materials to heal my body, or do I spend them to rebuild my deck?

This should be one of the core out-of-battle decisions.

---

## 6. Crafting System

Crafting should be very simple for the vertical slice.

There are only three crafting ingredients:

1. **Common Ingredient**
2. **Uncommon Ingredient**
3. **Rare Ingredient**

The better the ingredient, the better the crafted result.

Possible names:

- **Grave Dust** — common
- **Black Ichor** — uncommon
- **Demon Heart** — rare

These names can change later. For prototype implementation, the important part is the tier structure.

### Craftable Card Types

The player can craft:

- Instants
- Sorceries
- Enchantments
- Artifacts

The player **cannot** craft creature cards.

This is important because creature acquisition should come from exploration, battles, enemy decks, legendary creatures, merchants, and the village raid. If creatures can be crafted too easily, the player may be able to erase the intended pressure of creature attrition.

### Craftable Healing Items

The player can also craft healing items.

Healing items use the same ingredient pool as card crafting. A simple version could be:

- **Common Healing Item:** Costs 1 common ingredient. Restores a small amount of life.
- **Uncommon Healing Item:** Costs 1 uncommon ingredient. Restores a moderate amount of life.
- **Rare Healing Item:** Costs 1 rare ingredient. Restores a large amount of life, or gives a special survival effect.

Example healing items:

- **Bloodroot Poultice:** Restore 6 life. Costs 1 common ingredient.
- **Ichor Draught:** Restore 12 life. Costs 1 uncommon ingredient.
- **Demon's Mercy:** Restore 20 life or gain 10 life above current total. Costs 1 rare ingredient.

### Crafting Philosophy

Crafting should not become a complicated recipe system yet.

For the vertical slice, the player should mostly be choosing between categories:

- Craft a weak spell with common material
- Craft a stronger spell with uncommon material
- Craft a powerful spell/artifact with rare material
- Craft healing instead of a card

The goal is not to simulate alchemy. The goal is to create a clear survival economy.

---

## 7. Reward Identity by Activity

Each type of node should have a clear reward identity.

### Sorcerors

Sorcerors reward the player with **cards**.

When a sorceror is defeated, the player gains every card remaining in that sorceror's deck.

This means the player is incentivized to defeat sorcerors efficiently. If the enemy casts many of their best spells before losing, those cards will no longer be available as loot.

Sorcerors should not normally drop large amounts of gold, equipment, and crafting materials. Their reward identity is deck growth.

### Treasure Monsters

Treasure monsters reward the player with:

- Gold
- Crafting materials
- Equipment
- Occasional single cards

They should not primarily reward full decks of cards. Their purpose is to support the map economy and give the player reasons to take optional risks.

Each treasure monster should telegraph its reward category before the player chooses to fight.

### Legendary Creatures

Legendary creatures reward the player with the creature itself as a powerful card.

These fights are dangerous, but they provide unique power spikes that can help against the boss.

### Village Raid

The village raid rewards the player with several zombie creatures added to the deck.

This should feel powerful, but morally dark and mechanically consequential.

The major consequence is that a Paladin may appear unexpectedly in a later battle.

### Merchant

The merchant is a conversion point.

The player can:

- Buy cards
- Sell cards
- Buy equipment
- Buy healing items
- Possibly buy crafting materials

The merchant's wares refresh every time the player clears a node.

### Camp

The camp is the planning and crafting hub.

The player can:

- Choose the next node
- Craft spell cards
- Craft artifacts
- Craft healing items
- Review deck contents
- Change equipment
- Use healing items
- Manage inventory
- Visit the merchant interface, if the merchant is treated as accessible from camp

The camp does **not** automatically heal the player.

---

## 8. Node Layout Philosophy

Every node is accessible from the start.

The node map is not a physical path map where the player travels through crossroads, roads, and gates. It is a strategic selection map. From camp, the player chooses where to go next.

There should be no empty navigation nodes. Every node should contain content: a battle, a merchant, a crafting function, a raid, a boss challenge, or some other meaningful interaction.

### Suggested Presentation

The map can still be visual and atmospheric. It might show a dark valley around the player's camp, with icons for each location:

- Camp
- Merchant Wagon
- Abandoned Village
- Cave Mouth
- Three solo sorcerors
- Three legendary creature lairs
- Five treasure monster sites
- Boss fortress

But mechanically, the player is not walking icon-to-icon. The player clicks a node, resolves it, and returns to camp.

### Why This Works for the Prototype

This structure makes the player's strategic decisions clearer:

- Which enemy should I fight first?
- Do I need cards, materials, equipment, or life?
- Should I risk the cave now?
- Should I raid the village for zombies?
- Should I spend materials on healing or card crafting?
- Should I challenge the Red Dragon?
- Am I strong enough for the boss?

---

## 9. Full Node List

## Node 1: Player Camp

### Type

Safe hub / crafting node / node selection interface

### Description

A small black-mage camp hidden among dead trees and ash-covered stones. This is the player's base of operations during the vertical slice.

The camp contains a ritual circle, a small fire, a spellbook, and crude storage for reagents and scavenged cards.

### Function

At camp, the player can:

- Select any available node on the map
- Craft instants, sorceries, enchantments, artifacts, and healing items
- Review and edit the deck
- Equip one ring, one amulet, and one staff
- Use healing items
- Review inventory, gold, crafting materials, and cleared nodes

### Important Rule

The camp does not heal the player for free.

Returning to camp is safe, but not restorative unless the player spends resources.

---

## Node 2: Wandering Merchant

### Type

Merchant / economy node

### Description

A suspicious traveling merchant waits near the edge of the burned valley. The merchant is willing to buy and sell cards, equipment, healing items, and materials, but the inventory is unstable.

### Function

The player can:

- Buy cards
- Sell unwanted cards
- Buy equipment
- Buy healing items
- Possibly buy crafting ingredients

### Refresh Rule

The merchant's wares change every time the player clears a node.

A node is considered cleared when the player wins its battle or completes its main interaction.

This makes the merchant a dynamic part of the strategic loop. The player may return after clearing a node to see whether new items appeared.

### Design Purpose

The merchant turns battlefield success into preparation.

The player may sell cards gained from sorcerors in order to buy healing, equipment, or specific cards. This also gives value to cards that are not useful in the current deck.

---

## Node 3: Abandoned Village Raid

### Type

Optional power node / moral consequence node

### Description

A frightened village lies at the edge of the valley. The villagers have barricaded themselves indoors, hoping the sorcerors and monsters will pass them by.

The black mage can choose to raid the village, killing or corrupting its people and raising them as undead servants.

### Battle
In this battle, the opponent starts with two wall-type creatures on the battlefield. They are 0/10 creatures. The opponent's has 10 life, and their deck is composed entirely of weak little humans that don't do a whole lot, but there are a lot of them. 
By defeating this battle and winning all those human creature cards, the player gains a lot of fodder to be used by their zombie creation cards like Press Into Service. 

### Reward

If the player raids the village, several zombie creature cards are added to the player's deck or collection.

Example reward:

- 4 copies of **Village Zombie**
- 2 copies of **Rotting Militia**
- 1 copy of **Graveborn Bell-Ringer**

The exact cards can be tuned later.

### Consequence: Paladin Ambush

After the village is raided, a Paladin may appear unexpectedly in a later battle.

The Paladin does not appear as a separate node. Instead, the Paladin randomly joins the enemy side during a future battle, entering as a powerful creature card without warning.

Possible implementation:

- After the village raid, mark `paladin_vengeance = true`.
- At the start of each future battle, roll a chance for the Paladin to appear.
- The Paladin cannot appear during the village raid itself.
- The Paladin should probably not appear in trivial tutorial battles, if those exist.
- Once the Paladin appears, the flag is cleared.

### Paladin Example

**Vengeful Paladin**

- Large creature
- Protection or resistance against black effects
- Strong attacker
- Possibly destroys or weakens undead

Example effect:

> When Vengeful Paladin enters the battlefield, destroy target Zombie or Skeleton controlled by the player.

If the Paladin has not appeared by the time the player enters the boss fight, he will join in towards the end of the boss fight. He always joins in towards the end of a battle.

### Design Purpose

The village raid should be tempting because it gives the player creature cards, which cannot be crafted.

But the Paladin consequence makes it risky and memorable. The player receives immediate deck power, but may pay for it later at a terrible moment.

---

## Node 4: Ashroad Pyromancer

### Type

Solo sorceror battle / red burn mage

### Description

A red mage waits on a road of cooling ash, surrounded by burned wagons and blackened bones.

### Enemy Deck Identity

The Ashroad Pyromancer uses direct damage spells.

Expected cards:

- Damage to player
- Damage to creatures
- Cheap aggressive creatures
- Spells that finish games quickly

### Reward

The player gains all cards remaining in the Pyromancer's deck after victory.

### Strategic Pressure

This battle threatens the player's persistent life total more than the player's board.

The player may win the fight but leave with dangerously low life. It is a good test of whether the player values life enough in early routing decisions.

---

## Node 5: Emberhide Beastmaster

### Type

Solo sorceror battle / red creature mage

### Description

A red sorceror commands fire-touched beasts from a ring of cracked stones.

### Enemy Deck Identity

The Beastmaster uses creatures.

Expected cards:

- Efficient red creatures
- Haste creatures
- Combat tricks
- Creature buffs
- Some burn backup

### Reward

The player gains all cards remaining in the Beastmaster's deck after victory.

### Strategic Pressure

This battle pressures the player's creatures. It may force trades, causing the player to lose creature cards permanently after the battle.

This is a good node for testing whether creature attrition feels painful but fair.

---

## Node 6: The Black Rival

### Type

Solo sorceror battle / black mage mirror match

### Description

Another black mage has come to the valley seeking the same power as the player. Unlike the red sorcerors, this rival understands death magic, sacrifice, life drain, and graveyard exploitation.

### Enemy Deck Identity

The Black Rival uses black cards.

Expected cards:

- Life drain
- Sacrifice effects
- Removal
- Disposable creatures
- Graveyard interaction
- Possibly discard or hand attack

### Reward

The player gains all cards remaining in the Black Rival's deck after victory.

This is especially valuable because the rival's cards are likely to fit the player's deck better than the red sorcerors' cards.

### Strategic Pressure

This battle is dangerous because it contests the player on their own axis.

The rival may drain life, kill key creatures, or use sacrifice effects that make normal creature combat awkward.

### Design Purpose

Adding one black mage creates variety and gives the player a chance to win cards that directly support the starting strategy.

This also helps the map avoid feeling like every sorceror is just a red damage variant.

---

## Node 7: Collapsing Cave

### Type

Commitment node / two back-to-back sorceror battles

### Description

A cave mouth opens beneath a cliff of red stone. Ancient heat leaks from within. Once the player enters, the entrance collapses behind them.

The player must defeat two sorcerors in sequence before returning to camp.

### Cave Rules

When the player enters the cave:

- The player cannot return to camp between the two cave battles.
- The player cannot retreat from either battle.
- The player cannot visit the merchant between cave battles.
- The player cannot craft between cave battles.
- The player cannot change equipment between cave battles.
- The player cannot use out-of-battle healing items between cave battles, unless a special item explicitly allows cave use.
- The player's life total and deck state carry directly from Cave Battle 1 into Cave Battle 2.

### Cave Battle 1: Stonefire Ruiner

#### Enemy Deck Identity

Red land destruction / mana disruption.

Expected cards:

- Land destruction
- Temporary mana denial
- Small creatures
- Burn spells

#### Strategic Pressure

This enemy tests whether the player can function under mana disruption.

It also prepares the player for the final boss, where one of the red mages may specialize in land destruction.

### Cave Battle 2: Furnace Adept

#### Enemy Deck Identity

Red midrange / pressure deck.

Expected cards:

- Durable creatures
- Burn spells
- A few expensive threats
- Possibly artifact destruction

#### Strategic Pressure

The second cave battle punishes the player for entering the cave too early or too damaged.

The cave as a whole is the cleanest test of expedition commitment in the vertical slice.

### Reward

The player gains the remaining deck cards from each cave sorceror after each victory.

The cave may also grant a special treasure chest after both battles are completed.

Possible cave completion reward:

- Rare ingredient
- Equipment
- Gold
- A powerful artifact card

---

## Node 8: Skeleton Toll

### Type

Small monster battle / treasure guardian

### Description

A pack of skeletons clatters around an overturned grave-cart. The cart is full of bones, grave dust, and crude burial charms.

### Encounter Identity

Low-to-moderate danger. Teaches the player how monster treasure battles work.

The skeletons are weaker than sorcerors but can still force bad trades.

### Telegraph

Before entering, the player sees:

> The skeletons guard common necromantic materials.

### Reward

Mostly common crafting material.

Possible reward:

- Common ingredient
- Small amount of gold
- Possibly a weak artifact or minor black spell

### Design Purpose

This is the basic material node. It helps the player craft early without giving a major power spike.

---

## Node 9: Fire Hound Ambush

### Type

Small monster battle / treasure guardian

### Description

A pack of fire hounds circles a burned merchant wagon. Something metallic glows inside the wreckage.

### Encounter Identity

High life-total danger. Fire hounds attack quickly and punish slow starts.

### Telegraph

Before entering, the player sees:

> The hounds guard gold and possibly equipment.

### Reward

Possible reward:

- Gold
- Ring or amulet
- Common or uncommon ingredient

### Design Purpose

This node pressures life more than cards. It is a good choice for players who need merchant money or want a chance at equipment.

---

## Node 10: Spider Nest

### Type

Small monster battle / treasure guardian

### Description

A giant spider has webbed an old shrine and wrapped several bodies in silk. The cocoons may contain valuables or reagents.

### Encounter Identity

Creature-control danger. The spider may weaken, tap, poison, or destroy small creatures.

### Telegraph

Before entering, the player sees:

> The spider guards uncommon crafting material and possibly an enchantment-related reward.

### Reward

Possible reward:

- Uncommon ingredient
- Enchantment card
- Gold

### Design Purpose

This node gives access to better crafting while threatening the player's creature base.

---

## Node 11: Grave Wraith

### Type

Small monster battle / treasure guardian

### Description

A wraith haunts a ruined chapel, feeding on the memories of the dead. A black reliquary floats behind it.

### Encounter Identity

Life drain / evasion danger.

The wraith may be hard to block and may drain the player rather than simply attacking creatures.

### Telegraph

Before entering, the player sees:

> The wraith guards rare death-magic material.

### Reward

Possible reward:

- Uncommon ingredient
- Small chance of rare ingredient
- Dark artifact or amulet

### Design Purpose

This node should be scary because it threatens persistent life. It is a good place to reward a powerful crafting ingredient.

---

## Node 12: Mud Troll Bridge

### Type

Small monster battle / treasure guardian

### Description

A swollen mud troll squats beside a broken bridge, surrounded by offerings from travelers who hoped to pass alive.

### Encounter Identity

Big body / forced trades.

The troll is not subtle. It is large, hard to kill, and likely to force the player to spend removal or sacrifice creatures.

### Telegraph

Before entering, the player sees:

> The troll guards a heavy chest containing gold and materials.

### Reward

Possible reward:

- Gold
- Common ingredient
- Uncommon ingredient
- Chance of equipment

### Design Purpose

This node tests whether the player is willing to spend real cards to win treasure.

---

## Node 13: Legendary Snake

### Type

Legendary creature battle

### Description

An ancient serpent coils around a black spring. Its venom is said to grant visions of death.

### Encounter Identity

Poison, lifedrain, or evasive pressure.

The snake should be dangerous but not necessarily the hardest legendary creature.

### Reward

The player gains the Legendary Snake as a creature card.

### Synergy Note

This creature can synergize with the **Serpent Amulet** equipment:

> At the beginning of your end step, draw a card. If you control a Snake, you gain 2 life and each opponent loses 2 life. Otherwise, you lose 2 life.

### Design Purpose

This legendary creature supports a build-around item and rewards players who assemble a specific combo.

---

## Node 14: Legendary Spider

### Type

Legendary creature battle

### Description

A monstrous spider descends from a webbed tower, surrounded by the drained husks of previous challengers.

### Encounter Identity

Board control / creature suppression.

The spider may immobilize creatures, weaken them, or create smaller spider tokens.

### Reward

The player gains the Legendary Spider as a creature card.

### Design Purpose

This creature gives the player a powerful control-oriented creature option for the boss battle.

---

## Node 15: Red Dragon

### Type

Ultimate legendary creature battle

### Description

A red dragon sleeps in a crater of molten stone. Its wings are scarred with old spell-runes, and its breath has burned the valley for years.

This is the ultimate legendary monster in the vertical slice.

### Encounter Identity

Extremely dangerous. The Red Dragon should be one of the hardest optional battles on the map, possibly harder than any individual sorceror.

Expected behavior:

- Massive flying attacker
- Direct damage to player or creatures
- High toughness
- May punish small creature swarms
- May force the player to spend premium removal

### Telegraph

Before entering, the player should clearly understand:

> This is an extremely dangerous battle. Victory grants the Red Dragon as a legendary creature card.

### Reward

The player gains the **Red Dragon** as a powerful creature card.

- The Red Dragon keeps red costs, requiring the player to adapt their mana base.
- The Red Dragon can be sold for a large amount of gold if the player cannot use it.

### Design Purpose

The Red Dragon is the ultimate optional power spike.

It asks:

> Do I spend a huge amount of life and cards now to gain a weapon that may win the boss battle later?

---

## Node 16: Final Boss — The Red Council

### Type

Final boss battle / multi-sorceror battle

### Description

At the heart of the burned valley, three red mages conduct a ritual of conquest. Each represents a different expression of red magic: direct damage, land destruction, and creature violence.

This is the final exam of the vertical slice.

### Boss Structure

The boss battle is against **three full-powered red mages with full action economy**.

However, the battle does not begin with all three active.

### Phase 1: Two Red Mages

At the start of the boss battle, the player faces two red mages.

Suggested starting pair:

1. **The Burn Mage** — direct damage specialist
2. **The Beast Mage** — creature specialist

Both mages act at full power. They each cast spells, attack, and use their own deck at the normal rate.

### Phase 2: Third Mage Arrives

When one of the starting boss mages drops below a defined threshold, the third mage arrives.

Possible threshold:

- When either starting mage drops below 50% life
- When either starting mage reaches 10 or less life
- When the first starting mage dies

Recommended prototype version:

> When either starting mage drops to 10 or less life for the first time, the third mage arrives.

The third mage is:

3. **The Ruin Mage** — land destruction / mana disruption specialist

When the Ruin Mage arrives, retreat becomes impossible.

### Retreat Rule

Before the third mage arrives, the player may be allowed to retreat from the boss battle, preserving survival but suffering normal graveyard losses from the battle.

Once the third mage arrives:

- The exit is sealed.
- The player cannot retreat.
- The battle must end in victory or defeat.

### Boss Deck Identities

#### Burn Mage

- Direct damage to player
- Direct damage to creatures
- Fast spells
- Finisher burn

#### Beast Mage

- Efficient creatures
- Haste creatures
- Combat tricks
- Creature buffs

#### Ruin Mage

- Land destruction
- Mana disruption
- Artifact destruction
- Slower but devastating spells

### Why the Player Can Win

The fight is intentionally unfair in raw action economy. The player is facing multiple full-powered mages.

The player can win because by this point they may have:

- A life total far above 20 from black lifegain
- Powerful cards stolen from defeated sorcerors
- Legendary creatures captured from the map
- Equipment from treasure nodes
- Crafted spells and artifacts
- Healing items crafted from materials
- Zombies from the village raid
- A tuned deck built from the whole run

The boss battle should validate the entire preparation arc.

### Design Purpose

The boss should answer:

> Did the player use the map well enough to become terrifying?

The player should feel outnumbered, but not helpless. A well-prepared player should be able to beat the three mages through superior planning, deckbuilding, equipment, life management, and captured power.

---

## 10. Paladin Ambush System

The Paladin ambush is the major consequence for raiding the village.

### Trigger

The Paladin system activates only if the player raids the village.

### Behavior

After the village raid, the Paladin may appear in a future battle as a powerful creature joining the enemy side.

The Paladin should enter unexpectedly, but not arbitrarily enough to feel unfair. The game may give the player a warning after the raid, such as:

> Somewhere beyond the smoke, a horn sounds. Someone witnessed what you did.

### Possible Timing Rules

Option A: Random chance after every cleared node

- After village raid, each future battle has a 25% chance of Paladin arrival.
- Once the Paladin appears, it never appears again.

Option B: Guaranteed within next three battles

- After village raid, choose one of the next three battles secretly.
- The Paladin appears in that battle.

Option C: Boss-only consequence if not triggered earlier

- The Paladin has a chance to appear in normal battles.
- If the Paladin has not appeared before the boss, it appears during the boss battle.

### Recommended Prototype Version

Use Option B.

The Paladin appears in one of the next three battles after the village raid.

This preserves surprise while preventing the consequence from never happening.

### Paladin Combat Role

The Paladin should be especially dangerous to the player's undead strategy.

Possible effects:

- Destroys a Zombie or Skeleton when entering
- Has protection from black or resistance to black removal
- Deals extra damage if the player controls undead
- Prevents life gain while in play

### Design Purpose

The Paladin makes the village raid a real strategic decision instead of a free creature reward.

---

## 11. Merchant Refresh System

The merchant's wares change every time the player clears a node.

### What Counts as Clearing a Node?

A node is cleared when:

- The player defeats a sorceror
- The player defeats a treasure monster
- The player defeats a legendary creature
- The player completes the village raid
- The player completes both cave battles

The boss does not need to refresh the merchant afterward because the slice ends.

### What Should Refresh?

Possible merchant inventory categories:

- 3-5 cards
- 1 healing item
- 1 equipment item, sometimes
- 1-3 crafting ingredients
- 1 premium rare offer, sometimes

### Design Purpose

Refreshing wares makes the merchant relevant throughout the run.

It also gives the player a reason to return to camp after each node and reconsider the plan.

---

## 12. Suggested Complete Node Menu

From camp, the player sees every node immediately.

Example UI list:

1. Player Camp — craft, equip, manage deck, use healing items
2. Wandering Merchant — buy and sell cards, equipment, healing, materials
3. Abandoned Village — raid for zombie creatures; triggers Paladin consequence
4. Ashroad Pyromancer — red burn sorceror
5. Emberhide Beastmaster — red creature sorceror
6. Black Rival — black mirror-match sorceror
7. Collapsing Cave — two red sorcerors back-to-back with no recovery
8. Skeleton Toll — common material treasure fight
9. Fire Hound Ambush — gold/equipment treasure fight
10. Spider Nest — uncommon/enchantment treasure fight
11. Grave Wraith — rare death-material treasure fight
12. Mud Troll Bridge — gold/material treasure fight
13. Legendary Snake — capture snake creature
14. Legendary Spider — capture spider creature
15. Red Dragon — ultimate legendary creature
16. Final Boss: Red Council — three full-powered red mages

---

## 13. Suggested Initial Balancing Targets

These are not final numbers. They are starting targets for testing.

### Player

- Starts at 20 life
- Starts with one healing item
- Starts with no equipment
- Starts with a functional mono-black deck

### Healing

- No free healing
- Common healing item restores small life
- Uncommon healing item restores medium life
- Rare healing item restores large life or enables overhealing

### Crafting

- Three material tiers only
- Creatures cannot be crafted
- Healing items compete with cards for materials

### Sorcerors

- Solo sorcerors should be beatable by the starting deck, but costly if played poorly.
- Cave sorcerors should be individually manageable, but dangerous back-to-back.
- Black Rival should be rewarding because the cards fit the player's deck.

### Treasure Monsters

- Should be shorter than sorceror battles.
- Should threaten specific resources: life, creatures, removal, or tempo.
- Should telegraph reward category before the fight.

### Legendary Creatures

- Should be optional and dangerous.
- Should grant a major creature card when defeated.
- Red Dragon should be the hardest legendary creature.

### Boss

- Begins with two full-powered red mages.
- Third mage arrives mid-battle.
- Once third mage arrives, retreat is blocked.
- The boss should feel almost impossible for an unprepared player.
- A player who clears many nodes, crafts well, uses equipment, and builds a strong deck should be able to win.

---

## 14. Core Test Questions

The vertical slice should answer these questions:

1. Does permanent graveyard loss create exciting pressure, or does it feel too punitive?
2. Does persistent life make every battle feel meaningful?
3. Does the absence of free healing create good survival tension?
4. Does crafting healing items from the same materials as cards create interesting decisions?
5. Does the player understand that creatures cannot be crafted and must be earned elsewhere?
6. Does the open node map create interesting route planning without physical navigation?
7. Does the cave commitment create a memorable risk moment?
8. Does the village raid feel tempting enough to justify the Paladin consequence?
9. Does the Paladin ambush feel dramatic rather than unfair?
10. Do treasure monsters feel like meaningful resource decisions rather than filler fights?
11. Does the merchant refresh system make the economy feel alive?
12. Does the Red Dragon feel like a true ultimate optional monster?
13. Does the final boss validate all the player's preparation?
14. Does the player want to replay the map and try a different order?

---

## 15. Scope Control

The vertical slice should exclude:

- Real-time overworld movement
- Empty travel nodes
- Complex quest chains
- Large dialogue systems
- Full town simulation
- Procedural map generation
- Complex crafting recipes
- Creature card crafting
- Passive healing systems
- Large open-world exploration

The vertical slice should include:

- A camp-based node selection interface
- Meaningful battle choices
- Persistent life
- Permanent card loss
- Enemy deck looting
- Simple crafting
- Healing item tension
- Merchant refreshes
- Equipment choices
- Optional legendary monsters
- Village raid consequence
- Cave commitment
- Multi-mage boss battle

---

## 16. One-Sentence Design Summary

A black mage prepares for an impossible battle against three red sorcerors by choosing which dangerous nodes to clear from a camp-based map, constantly trading life, cards, materials, morality, and equipment for enough power to survive the final fight.

---

## 17. Alpha Slice Scope

This section documents the **alpha version** of the vertical slice — a focused, tunable cut of the design above intended to validate the core loop (persistent life + permanent graveyard loss + open node selection) before investing in the full slice's content and systems.

The full design above remains the destination. The alpha is a checkpoint along the way.

### Map contents (alpha)

Eight nodes:

1. **Camp** — switchboard. Edit active deck, view collection, start a new run.
2. **Wandering Merchant** — buy and sell cards. Refreshes on node clear.
3. **Ashroad Pyromancer** — solo sorceror (suggested: red burn).
4. **Emberhide Beastmaster** — solo sorceror (suggested: red creatures).
5. **Black Rival** — solo sorceror (suggested: black mirror).
6. **Hollow Acolyte** — solo sorceror (deck to be tuned).
7. **Veiled Hierophant** — solo sorceror (deck to be tuned).
8. **Wandering Heretic** — solo sorceror (deck to be tuned).
9. **Red Council (Final Boss)** — single red sorceror with **50 life** and **3 Mountains in play at game start**. No mid-battle phase transitions, no second/third mage. Tunable.

The three new sorcerors have color-agnostic names so the author can assign any deck identity to them via tags.

### Mechanics included

- Persistent player **life** across battles.
- Persistent player **deck** and **collection** across battles (collection is the master inventory; active deck is the subset taken into battle).
- **Permanent graveyard loss**: cards in the player's graveyard at battle end are removed from both deck and collection.
- **Looting**: defeating a sorceror adds all cards remaining in that sorceror's deck to the player's collection. Toggleable via tuning.
- **Gold rewards** per sorceror, set per node in tuning.
- **Merchant**: buy/sell cards. Inventory refreshes on node clear. Pricing formula and pool tunable.
- **Save / load** to localStorage.
- **Game-over** screen on death and on boss defeat. New-run button wipes campaign state.

### Mechanics explicitly excluded

The alpha **does not** include:

- Crafting and crafting ingredients
- Healing items (in-battle or out-of-battle)
- Equipment slots (ring / amulet / staff)
- Legendary creature battles
- Treasure monster battles
- Cave commitment node
- Village raid and Paladin ambush
- Multi-opponent boss (the alpha boss is a single sorceror with custom life + starting battlefield)
- Mid-battle player joins
- Retreat from battle
- Defender keyword and walls
- Protection / resistance keywords
- Creature subtypes (Zombie, Skeleton, Snake, etc.)
- Free healing at camp or between nodes

The player's only source of life recovery in the alpha is in-battle lifelink and similar effects from black cards. This is intentionally tight to validate whether the no-free-healing rule produces interesting pressure.

### Tooling for tuning

The alpha is built as a **playtesting tool**. The author can adjust every important value without code changes:

- **Tag system on decks.** Each deck in the deck library can carry one of five reserved tags: `player_starting`, `ashroad`, `emberhide`, `black_rival`, `boss`. Tagging is unique — assigning a tag transfers it from any previous holder. Tag lookup drives which deck each node uses at battle start.
- **Dual-mode deck editor.**
  - *Library mode* (accessible via the Decks nav button) — used for editing enemy decks and the `player_starting` template. Library pool is the full card database.
  - *Collection mode* (accessible from Camp during a run) — used by the player to build their active deck. Library pool is the current campaign collection only.
- **Tuning page** — a dedicated scene exposing:
  - Starting life and starting gold
  - Per-node gold rewards
  - "Loot remaining deck on win" toggle
  - Boss starting life and starting battlefield (configurable list of card ids)
  - Merchant offer count, buy/sell pricing formulas, and card pool filter
  - Reset campaign / reset tuning / export–import JSON

Tuning values persist independently of the active campaign, so adjusting a knob does not wipe a run.

### Scenes (alpha)

1. **MapScene** — campaign hub. Lists the 5 nodes with status and cleared markers.
2. **CampScene** — sub-scene reached from Map. Switchboard for deck editing and new-run.
3. **MerchantScene** — sub-scene reached from Map. Two-column buy/sell UI.
4. **BattleScene** — existing battle UI, extended to consume a `BattleConfig` (deck, starting life, starting battlefield) and report results back to the campaign layer.
5. **GameOverScene** — terminal state for death or victory.
6. **TuningScene** — top-level tuning page.
7. **DeckEditorScene** — existing, extended with a mode parameter (library vs collection).

Top-level scenes reached via the persistent nav bar: **Map**, **Decks**, **Tuning**.

### Build phasing

The alpha is built in three sequential PRs:

- **PR 1 — Infrastructure.** Tag system on decks, Tuning state + scene, engine extensions (custom starting life, pre-placed battlefield). No gameplay loop yet, but every tunable surface is in place.
- **PR 2 — Campaign loop.** Campaign state, Map / Camp / GameOver scenes, dual-mode deck editor, graveyard attrition. Playable end-to-end without the merchant. The merchant node is visible but disabled.
- **PR 3 — Merchant.** Merchant scene, gold rewards on node clear, merchant refresh logic. Closes the economy loop.

### What the alpha is meant to answer

Specifically, the alpha is intended to test these subset questions from Section 14:

1. Does permanent graveyard loss create exciting pressure, or does it feel too punitive?
2. Does persistent life make every battle feel meaningful?
3. Does the absence of free healing create good survival tension?
4. Does the open node map create interesting route planning without physical navigation?
5. Does the merchant refresh system make the economy feel alive?

Questions about crafting, healing items, equipment, legendary creatures, the cave, the village raid, the Paladin ambush, multi-mage boss tension, and replayability across multiple runs are **deferred** to subsequent slices.

### Promotion path

After alpha playtesting, the slice is expected to grow toward the full vertical slice by adding (in any order):

- Crafting + materials + healing items
- Equipment slots
- Treasure monster nodes
- Legendary creature nodes
- Cave commitment node
- Village raid + Paladin ambush
- Multi-opponent boss (two starting mages + third mage arrival)
- Retreat action

Each addition can land independently against the alpha foundation. The tag system, tuning page, and campaign state are designed to absorb these additions without restructuring.
