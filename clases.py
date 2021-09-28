# -*- coding: utf-8 -*-
"""
Created on Thu Sep 23 15:21:48 2021

@author: Usuario
"""
class comida:
    def __init__(self, nombre ):
        self.nombre = nombre
        self.reciente = 1
        self.costo = 2
        self.salud = 2
        self.rico = 2
        self.tiempo = 2
        self.ingredientes = {}
        self.guarniciones = {}
    def agregarGuarnicion(self,listaDeGuarniciones):
        if type(listaDeGuarniciones) != list:
            guarniciones = []
            guarniciones.append(listaDeGuarniciones)
        else:
            guarniciones = listaDeGuarniciones
        for guarnicion in guarniciones:
            if type(guarnicion)== str:
                newSide= side(guarnicion)
                newSide.comidas[self.nombre] = self
                self.guarniciones[newSide.nombre] = newSide
            elif isinstance(guarnicion,side):
                newSide = guarnicion
                newSide.comidas[self.nombre] = self
                self.guarniciones[newSide.nombre] = newSide                
            else:
                print('Type Error. No se agrego la guarnicion' + str(guarnicion))
    def agregarIngrediente(self,listaDeIngredientes):
        #if type(listaDeIngredientes) != list:
        if type (listaDeIngredientes)  != list:
            todosIngredientes = []
            todosIngredientes.append(listaDeIngredientes)
        else:
            todosIngredientes = listaDeIngredientes
        for ingr in todosIngredientes:
            if type(ingr) == str:
                newIngr= ingrediente(ingr)
                self.ingredientes[newIngr.nombre] = newIngr
                newIngr.comidas[newIngr.nombre] = self
            else:
                newIngr = ingr
                self.ingredientes[newIngr.nombre] = newIngr
                newIngr.comidas[self.nombre] = self
    def calcularPeso(self,reciente=1,costo=1,salud=1,rico=1,tiempo=1):
        self.peso = self.reciente-self.costo+self.salud+self.rico-self.tiempo
        for ingr in self.ingredientes:
            self.peso += ingr.reciente
    def guardar(self,usuario):
        usuario.guarniciones[self.nombre]=self
        for ingr in self.ingredientes:
            if ingr.nombre not in usuario.ingredientes:
                usuario.ingredientes[ingr.name] = ingr
        usuario.guardar()
class side:
    def __init__(self,nombre):
        self.nombre = nombre
        self.reciente = 1
        self.costo = 2
        self.salud = 2
        self.rico = 2
        self.tiempo = 2
        self.ingredientes = {}
        self.comidas = {}
    def agregarIngrediente(self,listaDeIngredientes):
        #if type(listaDeIngredientes) != list:
        if type (listaDeIngredientes)  != list:
            todosIngredientes = []
            todosIngredientes.append(listaDeIngredientes)
        else:
            todosIngredientes = listaDeIngredientes
        for ingr in todosIngredientes:
            if type(ingr) == str:
                newIngr= ingrediente(ingr)
                self.ingredientes[newIngr.nombre] = newIngr
                newIngr.guarniciones[self.nombre] = self
            else:
                newIngr = ingr
                self.ingredientes[newIngr.nombre] = newIngr
                newIngr.guarniciones[self.nombre] = self      
    def agregarComida(self,listaDecomidas):
        if type(listaDecomidas) != list:
            foods = []
            foods.append(listaDecomidas)
        else:
            foods = listaDecomidas
        for food in foods:
            if type(food)== str:
                newFood= comida(food)
                newFood.guarniciones[self.nombre] = self
                self.comidas[newFood.nombre] = newFood
            elif isinstance(food,comida):
                newFood = food
                newFood.guarniciones[newFood.nombre] = self
                self.comidas[newFood.nombre] = newFood  
            else:
                print('Type Error. No se agrego la guarnicion' + str(food))
    def calcularPeso(self,reciente=1,costo=1,salud=1,rico=1,tiempo=1):
        self.peso = self.reciente-self.costo+self.salud+self.rico-self.tiempo
        for ingr in self.ingredientes:
            self.peso += ingr.reciente
    def guardar(self,usuario):
        usuario.guarniciones[self.nombre]=self
        for ingr in self.ingredientes:
            if ingr.nombre not in usuario.ingredientes:
                usuario.ingredientes[ingr.name] = ingr
        usuario.guardar()
class ingrediente:
    def __init__(self,nombre):
        self.nombre = nombre
        self.reciente = 1
        #self.costo = 1
        #self.salud = 1
        #self.rico = 1
        self.comidas = {}
        self.guarniciones = {}
    def agregarComida(self,listaDeComidas):
        if type(listaDeComidas) != list:
            foods = []
            foods.append(listaDeComidas)
        else:
            foods = listaDeComidas
        for food in foods:
            if type(food) == str:
                newFood = comida(food)
            elif isinstance(food,comida):
                newFood = food
                newFood.ingredientes[self.nombre] = self
                self.comidas[food.nombre] = food
            else:
                print('Type Error. No se agrego la guarnicion' + str(food))                
    def agregarGuarnicion(self,listaDeGuarniciones):
        try:
            for guarnicion in listaDeGuarniciones:
                guarnicion.ingredientes.append(self)
                self.guarniciones.append(guarnicion)
        except TypeError:
            listaDeGuarniciones.ingredientes.append(self)
            self.guarniciones.append(listaDeGuarniciones)
    def guardar(self,usuario):
        usuario.ingredientes[self.nombre] = self
        usuario.guardar()