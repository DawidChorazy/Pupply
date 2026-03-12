import { useRef } from "react";
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import PagerView from "react-native-pager-view";

const { height } = Dimensions.get("window");

export default function RegisterSteps() {

  const pagerRef  = useRef<PagerView>(null);
  const currentPageRef = useRef(0);

  const goPrev = () => {
    const prev = Math.max(0, currentPageRef.current - 1);
    pagerRef.current?.setPage(prev);
    currentPageRef.current = prev;
  };

  const goNext = () => {
    const next = Math.min(2, currentPageRef.current + 1);
    pagerRef.current?.setPage(next);
    currentPageRef.current = next;
  };

  return (
    <View style={{ flex: 1 }}>
      <PagerView 
      ref={pagerRef}
      style={{ flex: 1}} 
      initialPage={0}
      onPageSelected={(e) => { currentPageRef.current = e.nativeEvent.position }}
      >

        <View style={styles.page} key="1">
          <View style={styles.innerPage}>
              <Text style={styles.title}>Jestem Kliniką</Text>
          </View>

          <TouchableOpacity style={[styles.arrow, {right: 10}]} onPress={goNext}>
            <Text style={styles.arrowText}>▶</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.page} key="2">

          <TouchableOpacity style={[styles.arrow, {left: 10}]} onPress={goPrev}>
            <Text style={styles.arrowText}>◀</Text>
          </TouchableOpacity>
                
          <View style={styles.innerPage}>
            <Text style={styles.title}>Jestem Zleceniodawcą</Text>   
          </View>

          <TouchableOpacity style={[styles.arrow, {right: 10}]} onPress={goNext}>
            <Text style={styles.arrowText}>▶</Text>
          </TouchableOpacity>

        </View>

        <View style={styles.page} key="3">
          <View style={styles.innerPage}>
              <Text style={styles.title}>Jestem zleceniobiorcą</Text>
          </View>

          <TouchableOpacity style={[styles.arrow, {left: 10}]} onPress={goPrev}>
            <Text style={styles.arrowText}>◀</Text>
          </TouchableOpacity>

        </View>

      </PagerView>

      

    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#7B6457"
  },
  pager:{
    flex: 1,
    paddingHorizontal: 20,
  },
  innerPage: {
    height: (height/6) * 5,
    width: "85%",
    backgroundColor: "white",
    alignItems: "center",
    borderRadius: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowRadius: 10,
    shadowOpacity: 0.2,
    overflow: "hidden",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    justifyContent: "flex-start",
    marginTop: 40,
  },
  arrow:{
    position: "absolute",
    top: ((height/6) * 5) / 2,
    transform: [{translateY: -15}],
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 10,
    borderRadius: 30,
    marginTop: 20,
  },
  arrowText:{
    fontSize: 40,
    color: "white",
  }
});