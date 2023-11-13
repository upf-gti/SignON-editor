# Tutorial

## Keyframe animation

## Script animation

Animations can be created in three ways:
- ***Add clip***: Create the animation from scratch adding a BML clip.
- ***Add preset***: Create the animation from a predefined set of clips based on common patterns.
- ***Add sign***: Create the animation from an existing glossa or sentence in the repository.

To select one of the options, you can press the buttons on the right panel or right click directly on the timeline.

### BML clips
A BML clip is an instruction for applying a verbal and/or nonverbal behaviour based on the Behaviour Markup Language. Each clip has an id, start time and duration, which can be modified by the user, and other properties that can vary. For every behavior, its realization may be broken down into phases. Each phase is bounded by a sync-point that carries the name of the transition it represents, making it relatively straight-forward to align behaviors at meaningful boundaries. The values of these sync-points are normalized by the duration and they don't take into account the start time. That is, the values are in the range [0, duration].

For the face: 
- Face Lexeme

<img src="face%20lexemes%20gui.PNG" width="400" title="Face lexeme clip panel" style="border-radius: 10px">
<!-- !["Face lexeme panel"](face%20lexemes%20gui.PNG "Face lexeme clip panel") -->

- Mouthing

For the head:
- Head movement
- Gaze

For the arms: 
- Elbow Raise
- Shoulder Raise
- Arm Location
- Hand Constellation
- Directed Motion
- Circular Motion

For the hands:
- Palm Orientation
- Hand Orientation
- Wrist Motion
- Fingerplay
- Handshape

For the whole body:
- Body movement