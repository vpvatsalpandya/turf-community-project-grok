package `in`.turfcommunity.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import kotlinx.coroutines.delay

class SplashActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = false
        setContent {
            SplashScreen(
                onDone = {
                    startActivity(Intent(this, DeskActivity::class.java))
                    finish()
                },
            )
        }
    }
}

private val Bg = Color(0xFF07110C)
private val Accent = Color(0xFF3DCF8A)
private val Fg = Color(0xFFE8F2EB)
private val Muted = Color(0xFF8AA394)

@Composable
private fun SplashScreen(onDone: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(700)
        onDone()
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PitchMark(modifier = Modifier.size(88.dp))
            Spacer(Modifier.height(20.dp))
            Text(
                text = "TURF COMMUNITY",
                color = Fg,
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = "The booking book, retired.",
                color = Muted,
                fontSize = 14.sp,
            )
        }
    }
}

@Composable
private fun PitchMark(modifier: Modifier = Modifier) {
    Canvas(modifier) {
        val w = size.width
        val h = size.height
        val stroke = w * 0.07f
        drawRoundRect(
            color = Accent,
            topLeft = Offset(w * 0.16f, h * 0.22f),
            size = Size(w * 0.68f, h * 0.56f),
            cornerRadius = CornerRadius(w * 0.04f),
            style = Stroke(width = stroke),
        )
        drawLine(
            color = Accent,
            start = Offset(w / 2f, h * 0.22f),
            end = Offset(w / 2f, h * 0.78f),
            strokeWidth = stroke,
        )
        drawCircle(
            color = Accent,
            radius = h * 0.10f,
            center = Offset(w / 2f, h / 2f),
            style = Stroke(width = stroke),
        )
    }
}
