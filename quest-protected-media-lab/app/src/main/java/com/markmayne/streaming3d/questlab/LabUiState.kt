package com.markmayne.streaming3d.questlab

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class LabUiState {
  var status by mutableStateOf("Waiting for Quest media surfaces…")
  var mode by mutableStateOf(ProbeMode.PROTECTED_MONO)
  var isPlaying by mutableStateOf(false)
  var mainPositionMs by mutableLongStateOf(0L)
  var sidecarPositionMs by mutableLongStateOf(0L)
  var driftMs by mutableLongStateOf(0L)
  var resyncs by mutableLongStateOf(0L)
  var sidecarLabel by mutableStateOf("virtual clock")
  var lastError by mutableStateOf("")
}
