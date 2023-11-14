# Tutorial

## Keyframe animation

## Script animation

<video autoPlay muted loop src="bml_animation.mp4" width="100%"></video>


Animations can be created in three ways:
- ***Add clip***: Create the animation from scratch adding a BML clip.
- ***Add preset***: Create the animation from a predefined set of clips based on common patterns.
- ***Add sign***: Create the animation from an existing glossa or sentence in the repository.

To select one of the options, you can press the buttons on the right panel or right click directly on the timeline.

### BML clips
A BML clip is an instruction for applying a verbal and/or nonverbal behaviour based on an extended Behaviour Markup Language. Each clip has an id, start time and duration. Users have the flexibility to modify these parameters, along with other variable properties. The realization of each behavior can be divided into phases, with each phase marked by a sync-point denoting the associated transition. Notably, these sync-point values are falling within the range [0, duration]. The time and the sync-point parameters are in seconds.

For the face: 
- #### Face Lexeme

Show a (partial) face expression from a predefined lexicon. This behavior offers a range of predefined expressions such as "RAISE_EYEBROWS"; 
<details>
<summary>Lexemes</summary>
</details>
<img src="face%20lexemes%20gui.PNG" width="400" title="Face lexeme clip panel" style="border-radius: 10px">
<!-- !["Face lexeme panel"](face%20lexemes%20gui.PNG "Face lexeme clip panel") -->

- #### Mouthing

For the head:
- #### Head movement
- #### Gaze

For the arms: 
- #### Elbow Raise
- #### Shoulder Raise
- #### Arm Location
- #### Hand Constellation
- #### Directed Motion
- #### Circular Motion

For the hands:
- #### Palm Orientation
- #### Hand Orientation
- #### Wrist Motion
- #### Fingerplay
- #### Handshape

For the whole body:
- #### Body movement