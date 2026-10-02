package com.markmayne.streaming3d.questlab

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun LabControls(
    state: LabUiState,
    onStart: (
        mode: ProbeMode,
        mediaUrl: String,
        licenseUrl: String,
        profileUrl: String,
        sidecarUrl: String,
    ) -> Unit,
    onTogglePlayback: () -> Unit,
    onSeekRelative: (Long) -> Unit,
) {
  var mediaUrl by remember { mutableStateOf(LabDefaults.MEDIA_URL) }
  var licenseUrl by remember { mutableStateOf(LabDefaults.LICENSE_URL) }
  var profileUrl by remember { mutableStateOf(LabDefaults.PROFILE_URL) }
  var sidecarUrl by remember { mutableStateOf(LabDefaults.SIDECAR_URL) }

  MaterialTheme {
    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xEE0B0E12),
    ) {
      Column(
          modifier =
              Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
          verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Text("3Dstreaming · Quest Protected Media Lab", style = MaterialTheme.typography.titleLarge)
        Text(
            "Widevine direct-to-surface + secure SBS routing + 3D sidecar timeline sync.",
            color = Color(0xFF9DA6B2),
        )

        OutlinedTextField(
            value = mediaUrl,
            onValueChange = { mediaUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("DASH media URL") },
            singleLine = true,
        )
        OutlinedTextField(
            value = licenseUrl,
            onValueChange = { licenseUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Widevine license URL") },
            singleLine = true,
        )
        OutlinedTextField(
            value = profileUrl,
            onValueChange = { profileUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Optional .3d.json profile URL") },
            singleLine = true,
        )
        OutlinedTextField(
            value = sidecarUrl,
            onValueChange = { sidecarUrl = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Optional depth.webm override") },
            singleLine = true,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Button(
              onClick = {
                onStart(
                    ProbeMode.PROTECTED_MONO,
                    mediaUrl,
                    licenseUrl,
                    profileUrl,
                    sidecarUrl,
                )
              },
          ) {
            Text("Protected mono")
          }
          Button(
              onClick = {
                onStart(
                    ProbeMode.PROTECTED_SECURE_SPLIT,
                    mediaUrl,
                    licenseUrl,
                    profileUrl,
                    sidecarUrl,
                )
              },
          ) {
            Text("Secure SBS split")
          }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          TextButton(onClick = onTogglePlayback) {
            Text(if (state.isPlaying) "Pause" else "Play")
          }
          TextButton(onClick = { onSeekRelative(-10_000L) }) { Text("-10s") }
          TextButton(onClick = { onSeekRelative(10_000L) }) { Text("+10s") }
        }

        Column(
            modifier =
                Modifier.fillMaxWidth()
                    .background(Color(0xFF151A20))
                    .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
          Text("Mode: ${state.mode}")
          Text("Status: ${state.status}")
          if (state.lastError.isNotBlank()) {
            Text("Error: ${state.lastError}", color = Color(0xFFFF9B9B))
          }
          Text("Main: ${state.mainPositionMs} ms")
          Text("Sidecar: ${state.sidecarPositionMs} ms (${state.sidecarLabel})")
          Text("Drift: ${state.driftMs} ms")
          Text("Resyncs: ${state.resyncs}")
        }

        Text(
            "Protected frames stay DIRECT_TO_SURFACE. The split probe tests fixed " +
                "StereoMode.LeftRight eye routing; it does not read or extract protected pixels.",
            color = Color(0xFF79838F),
        )
      }
    }
  }
}
